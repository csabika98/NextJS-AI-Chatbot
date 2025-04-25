export interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export const addMessage = (prevMessages: Message[], newMessage: Message): Message[] => {
  return [...prevMessages, newMessage];
};

export const createBotMessage = (text: string): Message => {
  return { sender: 'bot', text };
};

export const createUserMessage = (text: string): Message => {
  return { sender: 'user', text };
};