'use server';

import { CoreMessage, LanguageModelV1, streamText, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStreamableValue } from 'ai/rsc';
import * as PlayHT from 'playht'; // Import your PlayHT SDK (ensure it's installed and configured)
import dotenv from 'dotenv';

dotenv.config();

// Configure PlayHT if needed (or you might do this in a separate initialization module)
try {
  PlayHT.init({
    apiKey: process.env.PLAYHT_API_KEY!,
    userId: process.env.PLAYHT_USER_ID!,
  });
} catch (error: any) {
  console.error('Failed to initialise PlayHT SDK', error.message);
}

export async function continueConversation(messages: CoreMessage[]) {

  const result = await generateText({
    model: openai("gpt-3.5-turbo") as LanguageModelV1,
    messages
  });
   
  return result.text;
}

export async function continueConversation5(messages: CoreMessage[]) {
  const result = await streamText({
    model: openai('gpt-3.5-turbo') as LanguageModelV1,
    messages,
  });

  const stream = createStreamableValue(result.textStream);
  return stream.value;
}

export async function continueStreamConversation(messages: CoreMessage[]) {
  // Use the Vercel AI SDK to stream text from your language model.
  const result = await streamText({
    model: openai('gpt-3.5-turbo') as LanguageModelV1,
    messages,
  });

  const stream = createStreamableValue(result.textStream);

  // Pass the text stream to PlayHT to generate an audio stream.
  // Adjust the voiceId and voiceEngine parameters as per your PlayHT configuration.
  const audioStream = await PlayHT.stream(stream.value as string, {
    voiceId:
      's3://voice-cloning-zero-shot/801a663f-efd0-4254-98d0-5c175514c3e8/jennifer/manifest.json',
    voiceEngine: 'Play3.0-mini',
  });

  // Option 1: Return the audio stream directly (if your caller can work with it)
  return audioStream;
}