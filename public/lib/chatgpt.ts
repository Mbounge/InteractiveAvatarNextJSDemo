import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY,
// });
//const openai = new OpenAIApi(configuration);

export default openai;