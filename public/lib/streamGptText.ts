import openai from './chatgpt';
import { Readable } from 'node:stream';


export async function streamGptText(prompt: any) {
  if (!openai) {
    throw 'OpenAI API not initialised';
  }

  const startTime = Date.now();
  let firstByteReceivedTime: any;

  async function* createStream() {

    const chatGptResponseStream = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

    for await (const part of chatGptResponseStream) {
      if (!firstByteReceivedTime) {
        firstByteReceivedTime = Date.now();
      }
      yield part.choices[0]?.delta?.content || '';
    }
  }

  const stream = Readable.from(createStream());

  return {
    stream,
    getChatGptTTFB: () => firstByteReceivedTime ? firstByteReceivedTime - startTime : null
  };
}