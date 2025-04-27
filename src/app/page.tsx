'use client';

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import ChatBox from '@/app/components/ChatBox';
import { Message } from '@/app/utils/MessageManager';

const HomePage = () => {
  const [chatMessages, setChatMessages] = useState<{
    openai: Message[];
    ollama: Message[];
  }>({ openai: [], ollama: [] });
  const [provider, setProvider] = useState<'ollama' | 'openai'>('ollama');
  const [model, setModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const askEndpointChat = '/api/chat';

  useEffect(() => {
    if (provider === 'openai') {
      const openaiModel = process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL;
      const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

      if (!openaiModel || !openaiApiKey) {
        setError('Missing OpenAI configuration: NEXT_PUBLIC_OPENAI_DEFAULT_MODEL and NEXT_PUBLIC_OPENAI_API_KEY are required.');
        return;
      }
      setModel(openaiModel);
    } else {
      const ollamaHost = process.env.NEXT_PUBLIC_OLLAMA_HOST;
      const ollamaModel = process.env.NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME;

      if (!ollamaHost || !ollamaModel) {
        setError('Missing Ollama configuration: NEXT_PUBLIC_OLLAMA_HOST and NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME are required.');
        return;
      }
      setModel(ollamaModel);
    }
    setError(null);
    setIsInitialized(true);
  }, [provider]);

  const handleSetMessages = (newMessages: Message[]) => {
    setChatMessages((prev) => {
      const updatedMessages = Array.isArray(newMessages) ? newMessages : prev[provider] || [];
      const newState = {
        ...prev,
        [provider]: updatedMessages,
      };
      return newState;
    });
  };

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-red-600 text-xl">{error}</div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-gray-600 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen max-w-full max-h-full flex flex-col">
      <header className="flex justify-between items-center h-[80px] sm:h-[100px] px-4 sm:px-8 md:px-12 py-4 sm:py-6">
        <Image src="/logo.svg" alt="logo" width={120} height={60} className="h-[60px] sm:h-[80px]" />
      </header>
      <div className="flex-1">
        <div className="flex flex-col pt-4 sm:pt-6 pb-8 sm:pb-12 h-full mx-auto w-full max-w-[90%] sm:max-w-[1230px]">
          <div className="flex h-full flex-col">
            <div className="flex h-[40px] sm:h-[50px] gap-2 sm:gap-3">
              <div className="flex justify-center items-center text-base sm:text-xl bg-white min-w-[160px] sm:min-w-[180px] h-full rounded-t-[20px] shadow-md cursor-pointer hover:bg-gray-50 transition-colors duration-200 p-2 sm:p-3">
                Chatbot
              </div>
            </div>
            <div className="flex-1 bg-white shadow-[0_10px_15px_rgba(0,0,0,0.25)] z-[1] rounded-[0_50px_50px_50px] p-8">
              <div className="h-full">
                <ChatBox
                  askEndpoint={askEndpointChat}
                  model={model}
                  provider={provider}
                  setProvider={setProvider}
                  messages={chatMessages[provider] || []}
                  setMessages={handleSetMessages}
                  className="chat-container"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;