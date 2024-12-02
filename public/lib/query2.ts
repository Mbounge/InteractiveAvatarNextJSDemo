import openai from "./chatgpt";
import OpenAI from "openai";

const query = async (
  messages: any
): Promise<OpenAI.Chat.ChatCompletion | string> => {
  const handleError = (error: any): string => {
    if (error.code === "ENOTFOUND") {
      return "Oops! It seems that Graet couldn't connect to the server. Please check your internet connection and try again later.";
    } else if (error.code === "ECONNREFUSED") {
      return "Sorry, the server is currently unavailable. Please try again later.";
    } else if (error.code === "ETIMEDOUT") {
      return "The request timed out. Please check your internet connection and try again.";
    } else if (error.code === "EHOSTUNREACH") {
      return "Sorry, the host is unreachable. Please verify your network configuration or try again later.";
    } else if (error.code === "ECONNRESET") {
      return "The connection was reset. Please try again.";
    } else if (error.code === "ENETUNREACH") {
      return "The network is unreachable. Please check your network connectivity or try again later.";
    } else if (error.code === "EAI_AGAIN") {
      return "There was a DNS lookup failure. Please try again later.";
    } else if (
      error.status === 429 ||
      (error.response && error.response.status === 429)
    ) {
      // Rate limit error
      return "Rate limit exceeded. Please wait and try again later.";
    } else {
      return `Sorry, Graet encountered an error while processing your request. Error details: ${error.message}`;
    }
  };

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    messages: messages,
    model: "o1-mini", //o1-mini
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  };

  try {
    const chatCompletion: OpenAI.Chat.ChatCompletion =
      await openai.chat.completions.create(params);
    return chatCompletion.choices[0].message?.content || "No content received";
  } catch (err) {
    const errorMessage = handleError(err);
    return errorMessage;
  }
};

export default query;