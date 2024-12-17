# Create Simli App
This starter is an example of how to create a composable Simli interaction that runs in a Next.js app.
The project consists of a Next.js app that uses the Simli SDK (`simli-client`) and a server `server.ts` that handles the interaction with other services such as speech-to-text (STT), large language models (LLMs) and text-to-speech (TTS). 

### Environment variables
Start by signing up and getting your API key from [Simli.com](https://www.simli.com/). Then, fill in the `.env` file in the root of the project and put in the following environment variables:

```bash
NEXT_PUBLIC_SIMLI_API_KEY="API key from simli.com"
ELEVENLABS_API_KEY="Paid API key from elevenlabs.io (Free API key doesn't allow streaming audio)"
DEEPGRAM_API_KEY="API key from deepgram.com"
OPENAI_API_KEY="API key from OPENAI"
```

If you want to try Simli but don't have API access to these third parties, ask in Discord and we can help you out with that ([Discord Link](https://discord.gg/yQx49zNF4d)). 

To run the back-end and front-end together, run the following command:


```bash
npm run start
```

### Characters
You can swap out the character by finding one that you like in the [docs](https://docs.simli.com/introduction), or [create your own](https://app.simli.com/) 

![alt text](media/image.png) ![alt text](media/image-4.png) ![alt text](media/image-2.png) ![alt text](media/image-3.png) ![alt text](media/image-5.png) ![alt text](media/image-6.png)

### Alternative STT, TTS and LLM providers 
You can of course replace Deepgram and Elevenlabs with AI services with your own preference, or even build your own.
The only requirement for Simli to work is that audio is sent using PCM16 format and 16KHz sample rate or sending it through MediaStream. If you're having trouble getting nice audio, feel free to ask for help in Discord.  

## Links
[\[Simli\]](https://simli.com)   [\[Elevenlabs\]](https://elevenlabs.io) [\[Deepgram\]](https://deepgram.com)
 [\[Groq\]](https://groq.com)


## Deploy on Vercel

An easy way to deploy your avatar interaction to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). 
