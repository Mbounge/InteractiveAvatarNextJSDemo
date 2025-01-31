"use server";

import { tool, LanguageModelV1, CoreMessage } from "ai";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { retrieveGoalContextTool } from "./actions/retrieveGoalContext";
import { retrieveConversationContextTool } from "./actions/retrieveConversationContext";

export async function continueConversation2(
  messages: CoreMessage[],
  accessCode: string
) {
  const { steps, text } = await generateText({
    model: openai("gpt-4o-mini") as LanguageModelV1,
    messages,
    tools: {
      retrieveConversationContext: tool({
        description: `
        Use this tool to retrieve summaries of past conversations between the user and the AI from the vector database. This tool is specifically designed to help the AI understand the broader context of previous interactions, allowing it to enhance responses, provide continuity in conversations, and deliver more personalized recommendations.

        Invoke this tool when:

        The current query references prior conversations or when retrieving past context could help clarify the user’s intent.
        Accessing previous exchanges can enhance the AI's ability to respond meaningfully or maintain continuity in an ongoing conversation.
        Summarized past interactions may highlight key takeaways or insights relevant to the user’s current goals or questions.

        This tool queries the 'chat' namespace in the vector database, which contains embeddings of full conversations and their summaries. Each entry is enriched with metadata (e.g., timestamps) to ensure accurate retrieval of context.
        Avoid using this tool if the query can be fully addressed using the immediate context of the current conversation.
        `,
        parameters: z.object({
          userQuery: z.string().describe("The query for retrieving context."),
        }),
        execute: async ({ userQuery }) => {
          const results = await retrieveConversationContextTool.execute(
            {
              userId: accessCode, // Pass the accessCode as userId
              userQuery,
            },
            {} // Provide empty options object if required
          );
          return results;
        },
      }),

      // Retrieve goals tool with accessCode as userId
      retrieveGoalContext: tool({
        description: `
          Use this tool to retrieve the user's past goals and objectives from the vector database. This tool is designed to provide relevant goal-related context for improving the conversation or answering user queries effectively.

          Invoke this tool when:
          
          The query requires knowledge of the user's goals or objectives to provide a meaningful response.
          The conversation can be enhanced by understanding the user's previous progress, achievements, or aspirations.
          Access to the user's goal history is necessary to align recommendations or suggestions with their objectives.

          This tool queries a specialized 'goals' namespace in the vector database, which contains embeddings of user goals and session notes.
          Avoid using this tool if the query can be answered without referencing goal-related context.`,
        parameters: z.object({
          userQuery: z
            .string()
            .describe("The query or prompt for retrieving related goals."),
        }),
        execute: async ({ userQuery }) => {
          // Pass the accessCode as userId
          const results = await retrieveGoalContextTool.execute(
            {
              userId: accessCode, // Use the accessCode here
              userQuery,
            },
            {}
          );
          return results;
        },
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

  console.log("Updated Messages:", JSON.stringify(updatedMessages, null, 2));

  return { messages: updatedMessages, finalResponse: text };
}
