# Create Simli App
This starter is an example of how to create a composable Simli interaction that runs in a Next.js app.
The project consists of a Next.js app that uses the Simli SDK (`simli-client`) and dailybots(https://docs.dailybots.ai/introduction) a voice agent API, to construct a video agent interaction.

### Start by putting in environment variables
Create a `.env.local` file in the root of the project and add the following environment variables:

```bash
SIMLI_API_KEY=your-simli-api-key
DAILYBOTS_API_KEY=your_dailybots_api_key
```

To run the app, run the following command:


```bash
npm run start
```

### Characters
You can swap out the character by [creating your own](simli.com) or finding one that you like in the [docs](docs.simli.com). 

![alt text](media/image.png) ![alt text](media/image-4.png) ![alt text](media/image-2.png) ![alt text](media/image-3.png)


## Deploy on Vercel

The easiest way to deploy your avatar interaction to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme). 
