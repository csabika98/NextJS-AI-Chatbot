'use client';

import React, { useState, useEffect, useRef } from 'react';
import { addMessage, createUserMessage, createBotMessage, Message } from '@/app/utils/MessageManager';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

export interface ChatBoxProps {
  title: string;
  askEndpoint: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  className: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ askEndpoint, messages, setMessages, className }) => {
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaContRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); 

  const sendTechnicalMessage = async (message: string) => {
    setMessages((prev) => [...prev, { sender: 'bot', text: message }]);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    textareaResize();
    hitEnter();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const hitEnter = () => {
    const sendBtn = document.querySelector('.sendBtn') as HTMLElement | null;
    document.querySelectorAll('.skgpt-input-textarea').forEach((input) => {
      input.addEventListener('keydown', (e: Event) => {
        if (e instanceof KeyboardEvent && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn?.click();
        }
      });
    });
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => addMessage(prev, createUserMessage(input)));
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    const threadId = localStorage.getItem('threadId');
    const chroma_conversation_id = localStorage.getItem('chroma_conversation_id');

    if (!threadId) {
      await sendTechnicalMessage('No thread ID found. Please wait for the thread to be created.');
      setIsLoading(false);
      return;
    }
    if (!chroma_conversation_id) {
      await sendTechnicalMessage('No chroma_conversation_id found. Please wait for the thread to be created.');
      setIsLoading(false);
      return;
    }

    try {
      setMessages((prev) => addMessage(prev, createBotMessage('')));

      const response = await fetch(askEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          thread_id: threadId,
          chroma_conversation_id,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      let fullMessage = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const chunk = line.slice(6);
            fullMessage += chunk;

            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = createBotMessage(fullMessage);
              return newMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => addMessage(prev, createBotMessage('Error: Could not get a response.')));
    } finally {
      setIsLoading(false);
    }
  };

  const textareaResize = () => {
    const textarea = textareaRef.current;
    const textareaCont = textareaContRef.current;

    if (textarea && textareaCont) {
      textarea.addEventListener('input', () => {
        textareaCont.style.height = 'auto';
        textareaCont.style.height = `${textarea.scrollHeight + 20}px`;
      });
    }
  };

  return (
    <div className={`flex flex-col h-full gap-10 max-h-[660px] justify-between ${className}`}>
      <div
        className="chatMessages flex flex-col gap-8 p-8 max-h-[570px] overflow-y-auto scroll-smooth"
        ref={chatContainerRef}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.sender === 'user'
                ? 'userMessage bg-[#1ea974] self-end py-8 px-8 rounded-[50px_50px_0px_50px] max-w-[80%] text-white'
                : 'botMessage bg-[#e5e5e5] self-start py-8 px-8 pl-12 rounded-[50px_50px_50px_0] max-w-[80%] text-black'
            }
          >
            {msg.sender === 'bot' ? (
              <div className="flex flex-col">
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks]}
                  components={{
                    ol: ({ children }) => <ol className="pl-12 not-last:pb-6 list-decimal">{children}</ol>,
                    ul: ({ children }) => <ul className="pl-12 not-last:pb-6 list-disc">{children}</ul>,
                    p: ({ children }) => <p className="not-last:pb-1 last:pb-1">{children}</p>,
                    h3: ({ children }) => <h3 className="text-xl font-bold mb-4 pb-1 text-black">{children}</h3>,
                  }}
                >
                  {msg.text.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-base text-white">{msg.text}</div>
            )}
          </div>
        ))}
        {isLoading && <div className="loading text-center p-2.5">Loading...</div>}
      </div>
      <div className="flex items-end gap-3 min-h-[50px]">
        <div
          className="flex flex-1 bg-gray-200 p-4 px-8 rounded-[30px] h-[50px] transition-[height] duration-250 max-h-[200px]"
          ref={textareaContRef}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="skgpt-input-textarea border-none text-base text-black resize-none bg-transparent p-0 w-full font-[Poppins] min-h-[30px] placeholder:text-base focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write your question here..."
          />
        </div>
        <button
          className="skgpt-btn sendBtn h-[50px] w-[100px] text-xl text-white bg-[#1EA974] rounded-full border-none cursor-pointer"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBox;