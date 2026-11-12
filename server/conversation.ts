import { DeepgramClient } from "@deepgram/sdk";
import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";
import WebSocket, { type RawData } from "ws";
import { GREETING, SYSTEM_PROMPT, type Config } from "./config";
import { errMsg } from "./log";

// One conversation per browser WebSocket:
//
//   browser mic (PCM16 16 kHz) ──► Deepgram live STT ──► OpenAI (streamed text)
//        ──► ElevenLabs TTS WebSocket (pcm_16000) ──► browser ──► Simli sendAudioData
//
// Messages to the browser: binary frames are PCM16 16 kHz mono audio for Simli;
// text frames are JSON: {type: "interrupt"} (call ClearBuffer) or
// {type: "error", message}.

const PCM_BYTES_PER_SECOND = 32_000; // 16 kHz * 2 bytes
const AUDIO_CHUNK_BYTES = 6_000; // ~190 ms, a good size for sendAudioData
const MAX_HISTORY_MESSAGES = 20;

// Limits on what the browser may send.
const NO_AUDIO_TIMEOUT_MS = 15_000; // close if no mic frames arrive for this long
// Close if nobody has spoken (no transcript from the user, avatar silent) for this
// long. Based on speech, not bytes, so streaming silence doesn't hold a slot.
const NO_SPEECH_TIMEOUT_MS = 60_000;
// Token bucket for mic audio: real time is 32 KB/s; allow 2x sustained, 64 KB burst.
const INBOUND_BYTES_PER_SECOND = 64_000;
const INBOUND_BURST_BYTES = 64_000;
const MAX_QUEUED_CHUNKS = 50; // ~5 s of mic audio buffered while Deepgram connects
// Close a client that doesn't read what we send (protects server memory).
const MAX_CLIENT_BUFFERED_BYTES = 2 * 1024 * 1024;
const WS_OPEN = 1; // readyState of the Deepgram socket

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Everything belonging to one assistant reply, so a barge-in can cancel it. */
class Turn {
  readonly abort = new AbortController();
  text = "";
  get cancelled() {
    return this.abort.signal.aborted;
  }
}

export class Conversation {
  private openai: OpenAI;
  private deepgram: Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>> | null = null;
  private deepgramOpen = false;
  private queuedAudio: Buffer[] = [];
  private finals: string[] = [];
  private history: ChatMessage[] = [];
  private turn: Turn | null = null;
  /** Estimated time until the avatar finishes speaking the audio already sent. */
  private speakingUntil = 0;
  private closed = false;
  private timers: NodeJS.Timeout[] = [];
  private lastAudioAt = Date.now();
  private lastSpeechAt = Date.now();
  private bucket = { tokens: INBOUND_BURST_BYTES, at: Date.now() };

  constructor(
    private ws: WebSocket,
    private config: Config,
    private log: (msg: string) => void,
    /** Log what the user and the avatar say (LOG_TRANSCRIPTS). */
    private logTranscripts: boolean,
  ) {
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
  }

  async start() {
    this.ws.on("message", (data, isBinary) => this.onClientMessage(data, isBinary));
    this.ws.on("close", () => this.close());
    this.ws.on("error", (err) => {
      this.log(`client socket error: ${errMsg(err)}`);
      this.close();
    });

    // Bound the connection: idle mic, no speech, and total length (matches Simli's maxSessionLength).
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        if (now - this.lastAudioAt > NO_AUDIO_TIMEOUT_MS) this.end(4000, "Idle: no microphone audio");
        else if (now - Math.max(this.lastSpeechAt, this.speakingUntil) > NO_SPEECH_TIMEOUT_MS) {
          this.end(4000, "Idle: nobody spoke for a while");
        }
      }, 5_000),
      setTimeout(() => this.end(4001, "Maximum session length reached"), this.config.simli.maxSessionLength * 1000),
    );

    // The browser opens this socket only after Simli's start() resolved, so the
    // avatar is ready: greet right away, while STT connects in parallel.
    void this.respond({ fixedText: GREETING });
    await this.connectDeepgram();
  }

  // ---------------------------------------------------------------- browser in

  private onClientMessage(data: RawData, isBinary: boolean) {
    if (this.closed) return;
    if (!isBinary) {
      this.end(1003, "Only binary audio frames are accepted");
      return;
    }
    const chunk = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);

    const now = Date.now();
    const b = this.bucket;
    b.tokens = Math.min(INBOUND_BURST_BYTES, b.tokens + ((now - b.at) / 1000) * INBOUND_BYTES_PER_SECOND);
    b.at = now;
    b.tokens -= chunk.length;
    if (b.tokens < 0) {
      this.end(1008, "Too much audio data");
      return;
    }
    this.lastAudioAt = now;

    if (this.deepgram && this.deepgramOpen) {
      this.sendToDeepgram(chunk);
    } else if (this.queuedAudio.length < MAX_QUEUED_CHUNKS) {
      this.queuedAudio.push(chunk);
    }
  }

  /** The SDK throws when its socket is not open (e.g. closing): end cleanly instead of crashing. */
  private sendToDeepgram(chunk: Buffer) {
    const dg = this.deepgram;
    if (!dg) return;
    try {
      if (dg.readyState !== WS_OPEN) throw new Error("Deepgram socket is not open");
      dg.sendMedia(chunk);
    } catch (err) {
      this.deepgramOpen = false;
      this.log(`Deepgram send failed: ${errMsg(err)}`);
      this.fail("Speech-to-text (Deepgram) disconnected.");
    }
  }

  // ------------------------------------------------------------ speech-to-text

  private async connectDeepgram() {
    const { apiKey, model, language } = this.config.deepgram;
    try {
      const client = new DeepgramClient({ apiKey });
      const dg = await client.listen.v1.connect({
        model,
        language,
        encoding: "linear16",
        sample_rate: 16000,
        channels: 1,
        smart_format: "true",
        interim_results: "true", // needed for fast barge-in and for utterance_end_ms
        endpointing: 300, // ms of silence that ends an utterance (speech_final)
        utterance_end_ms: 1000, // backup end-of-utterance signal when there is background noise
        vad_events: "true",
        reconnectAttempts: 0, // fail clearly instead of retrying a bad key 30 times
      });
      if (this.closed) {
        dg.close();
        return;
      }
      this.deepgram = dg;
      dg.on("message", (msg) => this.onTranscriptMessage(msg));
      dg.on("error", (err) => {
        this.log(`Deepgram error: ${errMsg(err)}`);
        this.fail("Speech-to-text (Deepgram) failed. Check DEEPGRAM_API_KEY and the server logs.");
      });
      dg.on("close", () => {
        const wasOpen = this.deepgramOpen;
        this.deepgramOpen = false;
        if (this.closed) return;
        this.fail(
          wasOpen
            ? "Speech-to-text (Deepgram) disconnected."
            : "Could not connect to speech-to-text (Deepgram). Check DEEPGRAM_API_KEY.",
        );
      });
      dg.connect();
      await dg.waitForOpen();
      this.deepgramOpen = true;
      for (const chunk of this.queuedAudio.splice(0)) this.sendToDeepgram(chunk);
      // Deepgram closes streams that get no audio for 10 s (e.g. a muted mic).
      this.timers.push(
        setInterval(() => {
          const d = this.deepgram;
          if (!this.deepgramOpen || !d) return;
          try {
            if (d.readyState !== WS_OPEN) throw new Error("Deepgram socket is not open");
            d.sendKeepAlive({ type: "KeepAlive" });
          } catch (err) {
            this.deepgramOpen = false;
            this.log(`Deepgram keep-alive failed: ${errMsg(err)}`);
            this.fail("Speech-to-text (Deepgram) disconnected.");
          }
        }, 8_000),
      );
      this.log("Deepgram connected");
    } catch (err) {
      // The SDK rejects with an event object that includes the request headers
      // (the API key): log only a sanitized message.
      this.log(`Deepgram connect failed: ${errMsg(err)}`);
      this.fail("Could not connect to speech-to-text (Deepgram). Check DEEPGRAM_API_KEY.");
    }
  }

  private onTranscriptMessage(msg: { type: string }) {
    try {
      if (this.closed) return;
      if (msg.type === "Results") {
        const r = msg as unknown as {
          is_final?: boolean;
          speech_final?: boolean;
          channel?: { alternatives?: { transcript?: unknown }[] };
        };
        const raw = r.channel?.alternatives?.[0]?.transcript;
        const transcript = typeof raw === "string" ? raw.trim() : "";
        if (!transcript) return;
        this.lastSpeechAt = Date.now();

        // Barge-in: the user said something while the avatar is talking or about to.
        this.interruptIfSpeaking();

        if (r.is_final) this.finals.push(transcript);
        if (r.speech_final) this.commitUtterance();
      } else if (msg.type === "UtteranceEnd") {
        this.commitUtterance();
      }
    } catch (err) {
      this.log(`bad transcript message: ${errMsg(err)}`);
    }
  }

  private commitUtterance() {
    if (this.finals.length === 0) return;
    const text = this.finals.join(" ");
    this.finals = [];
    if (this.logTranscripts) this.log(`user: ${text}`);
    void this.respond({ userText: text });
  }

  // ------------------------------------------------------------- interruption

  private interruptIfSpeaking() {
    const busy = this.turn !== null || Date.now() < this.speakingUntil;
    if (!busy) return;
    this.cancelTurn();
    this.speakingUntil = 0;
    // Messages on one socket stay in order, so no audio of the cancelled reply
    // can arrive after this: the browser clears Simli's buffer and stays clear.
    this.sendJson({ type: "interrupt" });
  }

  private cancelTurn() {
    const turn = this.turn;
    if (!turn) return;
    this.turn = null;
    turn.abort.abort();
    if (turn.text.trim()) this.remember({ role: "assistant", content: turn.text.trim() + "…" });
  }

  private remember(m: ChatMessage) {
    this.history.push(m);
    if (this.history.length > MAX_HISTORY_MESSAGES) this.history.splice(0, this.history.length - MAX_HISTORY_MESSAGES);
  }

  // ----------------------------------------------------------- reply pipeline

  private async respond(input: { userText?: string; fixedText?: string }) {
    this.interruptIfSpeaking(); // normally already done by the first interim transcript
    const turn = new Turn();
    this.turn = turn;
    if (input.userText) this.remember({ role: "user", content: input.userText });

    const tts = this.openTts(turn);
    try {
      if (input.fixedText) {
        turn.text = input.fixedText;
        tts.say(input.fixedText);
      } else {
        await this.streamLlm(turn, tts.say);
      }
      tts.finish();
      await tts.done;
      if (this.turn === turn) {
        this.turn = null;
        if (turn.text.trim()) this.remember({ role: "assistant", content: turn.text.trim() });
        if (this.logTranscripts) this.log(`assistant: ${turn.text.trim()}`);
      }
    } catch (err) {
      tts.cancel();
      if (turn.cancelled || this.closed) return;
      if (this.turn === turn) this.turn = null;
      this.log(`reply failed: ${errMsg(err)}`);
      this.sendJson({ type: "error", message: describeProviderError(err) });
    }
  }

  /** Streams the model's reply and hands it to TTS sentence by sentence. */
  private async streamLlm(turn: Turn, say: (text: string) => void) {
    const { model, reasoningEffort } = this.config.openai;
    const stream = await this.openai.responses.create(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: this.history,
        stream: true,
        store: false,
        max_output_tokens: 300,
        ...(reasoningEffort && reasoningEffort !== "off"
          ? { reasoning: { effort: reasoningEffort as ReasoningEffort } }
          : {}),
      },
      { signal: turn.abort.signal },
    );

    let pending = "";
    for await (const event of stream) {
      if (turn.cancelled) break;
      if (event.type === "response.output_text.delta") {
        turn.text += event.delta;
        pending += event.delta;
        // Send whole sentences (or long clauses) so ElevenLabs can start speaking early.
        let m: RegExpMatchArray | null;
        while ((m = pending.match(/^([\s\S]*?[.!?…](?:["')\]]*))\s+([\s\S]*)$/)) || pending.length > 120) {
          if (m) {
            say(m[1]);
            pending = m[2];
          } else {
            const cut = pending.lastIndexOf(" ");
            if (cut <= 0) break;
            say(pending.slice(0, cut));
            pending = pending.slice(cut + 1);
          }
        }
      } else if (event.type === "error") {
        throw new Error(`OpenAI stream error: ${event.message}`);
      }
    }
    if (!turn.cancelled && pending.trim()) say(pending);
  }

  /**
   * One ElevenLabs stream-input WebSocket per reply. Audio comes back as base64
   * PCM16 16 kHz (output_format=pcm_16000), exactly what Simli takes, so it is
   * forwarded without resampling.
   */
  private openTts(turn: Turn) {
    const { apiKey, voiceId, modelId } = this.config.elevenlabs;
    const url =
      `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input` +
      `?model_id=${encodeURIComponent(modelId)}&output_format=pcm_16000`;
    const el = new WebSocket(url, { headers: { "xi-api-key": apiKey } });
    const outbox: string[] = [JSON.stringify({ text: " " })]; // first message opens the stream
    let carry: Buffer | null = null; // keeps sample alignment across chunks

    const send = (msg: object) => {
      const s = JSON.stringify(msg);
      if (el.readyState === WebSocket.OPEN) el.send(s);
      else if (el.readyState === WebSocket.CONNECTING) outbox.push(s);
    };

    const done = new Promise<void>((resolve, reject) => {
      el.on("open", () => {
        for (const s of outbox.splice(0)) el.send(s);
      });
      el.on("message", (raw) => {
        if (turn.cancelled) return;
        let msg: { audio?: string | null; isFinal?: boolean; error?: string; message?: string };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.error) {
          reject(new Error(`ElevenLabs: ${msg.error}${msg.message ? ` (${msg.message})` : ""}`));
          el.close();
          return;
        }
        if (msg.audio) {
          let pcm = Buffer.from(msg.audio, "base64");
          if (carry) {
            pcm = Buffer.concat([carry, pcm]);
            carry = null;
          }
          if (pcm.length % 2) {
            carry = pcm.subarray(pcm.length - 1);
            pcm = pcm.subarray(0, pcm.length - 1);
          }
          this.sendAudio(pcm);
        }
        if (msg.isFinal) el.close();
      });
      el.on("unexpected-response", (_req, res) => {
        reject(new Error(`ElevenLabs: HTTP ${res.statusCode}`));
        el.terminate();
      });
      el.on("error", (err) => reject(new Error(`ElevenLabs: ${err.message}`)));
      el.on("close", (code, reason) => {
        if (turn.cancelled || code === 1000 || code === 1005) resolve();
        else reject(new Error(`ElevenLabs closed the stream (${code}${reason.length ? `: ${reason}` : ""})`));
      });
    });
    done.catch(() => {}); // handled where it's awaited; this avoids an unhandled rejection meanwhile
    turn.abort.signal.addEventListener("abort", () => el.terminate(), { once: true });

    return {
      done,
      // A trailing space and flush make ElevenLabs generate each sentence right away.
      say: (text: string) => send({ text: text.trim() + " ", flush: true }),
      finish: () => send({ text: "" }), // empty text = end of input; ElevenLabs then sends isFinal
      cancel: () => el.terminate(),
    };
  }

  private sendAudio(pcm: Buffer) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    if (this.ws.bufferedAmount > MAX_CLIENT_BUFFERED_BYTES) {
      this.end(1008, "Client is not reading audio");
      return;
    }
    for (let i = 0; i < pcm.length; i += AUDIO_CHUNK_BYTES) {
      this.ws.send(pcm.subarray(i, i + AUDIO_CHUNK_BYTES), { binary: true });
    }
    const now = Date.now();
    this.speakingUntil = Math.max(this.speakingUntil, now) + (pcm.length / PCM_BYTES_PER_SECOND) * 1000;
  }

  // ----------------------------------------------------------------- lifecycle

  private sendJson(msg: object) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Tell the browser what went wrong, then end the conversation. */
  private fail(message: string) {
    if (this.closed) return;
    this.sendJson({ type: "error", message });
    this.end(1011, "Conversation failed");
  }

  private end(code: number, reason: string) {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close(code, reason);
    }
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.cancelTurn();
    const dg = this.deepgram;
    this.deepgram = null;
    if (dg) {
      try {
        if (this.deepgramOpen && dg.readyState === WS_OPEN) dg.sendCloseStream({ type: "CloseStream" });
        dg.close();
      } catch {
        // already closing
      }
    }
    this.deepgramOpen = false;
    this.queuedAudio = [];
    this.log("conversation closed");
  }
}

/** A message for the browser. Never includes keys; details stay in the server log. */
function describeProviderError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY.";
    if (err.status === 404) return "OpenAI model not found. Check OPENAI_MODEL.";
    if (err.status === 429) return "OpenAI rate limit or quota reached.";
    return `OpenAI request failed (${err.status ?? "network error"}).`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ElevenLabs")) {
    if (/401|403|api.?key|unauthori/i.test(msg)) return "ElevenLabs rejected the request. Check ELEVENLABS_API_KEY and your plan.";
    if (/voice/i.test(msg)) return "ElevenLabs couldn't use that voice. Check ELEVENLABS_VOICE_ID.";
    return "Text-to-speech (ElevenLabs) failed. See the server logs.";
  }
  return "The assistant couldn't answer. See the server logs.";
}
