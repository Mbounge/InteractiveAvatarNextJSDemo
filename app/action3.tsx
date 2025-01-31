"use server";

import { tool, LanguageModelV1, CoreMessage } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import { TavilyClient } from '@agentic/tavily'


export async function ConvoFunc(messages: CoreMessage[]) {
  const { steps, text } = await generateText({
    model: openai("gpt-3.5-turbo") as LanguageModelV1,
    messages,
    tools: {
        weather: tool({
          description: 'Get the weather in a location',
          parameters: z.object({
            location: z.string().describe('The location to get the weather for'),
          }),
          execute: async ({ location }) => ({
            location,
            temperature: 72 + Math.floor(Math.random() * 21) - 10,
          }),
        }),
      },
    maxSteps: 5, // allow up to 5 steps
  });

  const updatedMessages = [...messages];

  // Iterate over steps to extract tool calls, results, and responses
  steps.forEach((step) => {
    if (step.toolCalls && step.toolCalls.length > 0) {
      // Add tool calls to the messages as part of the assistant's response
      step.toolCalls.forEach((call) => {
        updatedMessages.push({
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.args,
            },
          ],
        });
      });
    }

    if (step.toolResults && step.toolResults.length > 0) {
      // Add tool results to the messages with role: "tool"
      step.toolResults.forEach((result) => {
        updatedMessages.push({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: result.toolCallId,
              toolName: result.toolName,
              result: result.result,
            },
          ],
        });
      });
    }

    if (step.text) {
      // Add the AI's text response
      updatedMessages.push({
        role: "assistant",
        content: step.text,
      });
    }
  });

  // search results -- to see if they work
  const tavily = new TavilyClient({apiKey: "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"})

  const res = await tavily.search('Who is Leo Messi?')

  console.log('news')
  console.log(res)

  console.log("Updated Messages:", JSON.stringify(updatedMessages, null, 2));

  return { messages: updatedMessages, finalResponse: text };
}



  
  
  
  
