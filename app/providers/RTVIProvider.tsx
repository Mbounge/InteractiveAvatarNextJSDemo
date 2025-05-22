import { type PropsWithChildren } from 'react';
import { RTVIClient } from '@pipecat-ai/client-js';
import { DailyTransport } from '@pipecat-ai/daily-transport';
import { RTVIClientProvider } from '@pipecat-ai/client-react';
import { baseTemplatePlayer } from '../lib/constants';

const transport = new DailyTransport();

const weatherInstruct = `You are a helpful assistant who converses with a user and answers questions. Respond concisely to general questions.Your response will be turned into speech so use only simple words and punctuation.You have access to two tools: get_weather and add_todo.
 You can respond to questions about the weather using the get_weather tool. All requests that are meant for athletic training programs, meal plans, mental drills and research orientated requests will be given to the 
 add_todo function to be executed later. Make sure to use everything that has been said in the conversation to help you make a good description for the task in add_todo. Those descriptions need provide as much information as possible for the task to be done`

const client = new RTVIClient({
  transport,
  params: {
    baseUrl: 'http://localhost:7860',
    endpoints: {
      connect: '/connect',
    },
    requestData: {
      instructions: baseTemplatePlayer,
      user_id: "Bo"
    }
  },
  enableMic: true,
  enableCam: true,
});

export function RTVIProvider({ children }: PropsWithChildren) {
  return <RTVIClientProvider client={client}>{children}</RTVIClientProvider>;
}