export interface Message {
  sender: 'user' | 'bot';
  text: string;
  provider?: string;
  model?: string;
}

export const createUserMessage = (text: string): Message => {
  console.log(`Creating user message: ${text}`);
  return { sender: 'user', text };
};

export const createBotMessage = (text: string, provider: string, model: string): Message => {
  console.log(`Creating bot message: ${text}, provider: ${provider}, model: ${model}`);
  return { sender: 'bot', text, provider, model };
};