# Create a composable Simli interaction
This starter is a simple example of how to create a Simli interaction on a website. 
The project consists of a simple Next.js app that uses the Simli SDK (`simli-client`) and a server `server.js` that handles the interaction with other services such as LLMs and TTS. 

### Start by putting in environment variables
Create a `.env.local` file in the root of the project and add the following environment variables:

```bash
SIMLI_API_KEY=your-simli-api-key
GROQ_API_KEY=your-groq-api-key-\
DEEPGRAM_API_KEY=your-deepgram-api-key-\
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

Of course, you can replace Deepgram and Elevenlabs with AI services with your own preference (or build your own).
The most basic requirement for Simli to work is that audio is sent using PCM16 format and 16KHz. 


To run the development server:

```bash
node server.js && npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

### Characters
You'll start with Einstein but you can add more characters by [creating your own](simli.com) or finding one that you like in the [docs](docs.simli.com). 



## Deploy on Vercel

The easiest way to deploy your app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
