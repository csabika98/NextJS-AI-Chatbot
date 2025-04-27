export interface Message {
  sender: 'user' | 'bot';
  text: string;
  provider?: string;
  model?: string;
}

export const createUserMessage = (text: string): Message => {
  return { sender: 'user', text };
};

export const createBotMessage = (text: string, provider: string, model: string): Message => {
  return { sender: 'bot', text, provider, model };
};