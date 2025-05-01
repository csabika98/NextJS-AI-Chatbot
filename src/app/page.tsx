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
      <header className="flex justify-between items-center gap-[1rem] h-[80px] sm:h-[100px] px-4 sm:px-8 md:px-12 py-4 sm:py-6">
        <Image src="/logo.svg" alt="logo" width={120} height={60} className="w-[120px] h-auto hidden sm:block" />
        <div></div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row mx-auto w-full max-w-[1530px] px-4 sm:px-8 md:px-12">
        <div className="hidden md:flex flex-col items-center justify-center w-[200px] md:w-[300px] py-4 relative">
          <Image
            src="/logo.svg"
            alt="Chatbot logo"
            width={191}
            height={149}
            className="w-[150px] md:w-[191px] h-auto mb-4"
          />
          <Image
            src="/gears.png"
            alt="Gears"
            width={267}
            height={380}
            className="w-[150px] md:w-[200px] h-auto mb-4"
            style={{ color: 'transparent' }}
          />
          <Image
            src="/robot.png"
            alt="Robot"
            width={150}
            height={150}
            style={{ color: 'transparent' }}
            className="w-[120px] md:w-[350px] h-auto relative -mr-8 md:-mr-20"
          />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex flex-col pt-4 sm:pt-6 pb-8 sm:pb-12 w-full h-full">
            <div className="flex flex-col">
              <div className="flex-1 bg-white shadow-lg rounded-[40px] p-4 sm:p-6 md:p-8">
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
    </div>
  );
};

export default HomePage;