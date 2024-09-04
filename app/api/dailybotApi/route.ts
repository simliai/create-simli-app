import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { services, config } = await request.json();

    const payload = {
      bot_profile: "voice_2024_08",
      max_duration: 600,
      services,
      config,
    };

    const response = await fetch("https://api.daily.co/v1/bots/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DAILYBOTS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const botData = await response.json();
    return NextResponse.json(botData);
  } catch (error) {
    console.error("Error starting bot:", error);
    return NextResponse.json({ error: "Failed to start bot" }, { status: 500 });
  }
}