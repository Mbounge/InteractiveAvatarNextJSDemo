'use server';

import { CoreMessage, LanguageModelV1, streamText, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function continueConversation(messages: CoreMessage[]) {

  const result = await generateText({
    model: openai("gpt-3.5-turbo") as LanguageModelV1,
    messages
  });
   
  return result.text;
}