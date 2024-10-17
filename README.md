# Create Simli App
This starter is an example of how to create a composable Simli interaction that runs in a Next.js app.
The project consists of a Next.js app that uses the Simli SDK (`simli-client`) and a server `server.js` that handles the interaction with other services such as speech-to-text (STT), large language models (LLMs) and text-to-speech (TTS). 

### Environment variables
Start by signing up and getting your API key from [Simli.com](https://www.simli.com/). Then, fill in the `.env` file in the root of the project and put in the following environment variables:

```bash
NEXT_PUBLIC_OPENAI_API_KEY="API key from OPENAI"
```

If you want to try Simli but don't have API access to these third parties, ask in Discord and we can help you out with that ([Discord Link](https://discord.gg/yQx49zNF4d)). 

To run the back-end and front-end together, run the following command:


```bash
npm run start
```

### Characters
You can swap out the character by finding one that you like in the [docs](https://docs.simli.com/introduction), or creating your own (coming soon!). 

![alt text](media/image.png) ![alt text](media/image-4.png) ![alt text](media/image-2.png) ![alt text](media/image-3.png) ![alt text](media/image-5.png) ![alt text](media/image-6.png)


## Links
[\[Simli\]](https://simli.com)

## Deploy on Vercel
An easy way to deploy your avatar interaction to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). 
