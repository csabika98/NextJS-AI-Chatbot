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
      <div className="w-screen min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-600 text-xl">{error}</div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="w-screen min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen max-w-full flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 md:items-center flex flex-col md:flex-row mx-auto w-full max-w-[1530px] px-4 sm:px-8 md:px-12 overflow-hidden">
        <div className="hidden md:flex flex-col items-center justify-start w-[200px] md:w-[300px] py-4 md:py-8 px-2 relative shrink-0 space-y-4 md:space-y-6">
          <div className="w-full flex justify-center flex-shrink-0 px-4">
            <Image
              src="/logo.png"
              alt="NextJS logo"
              width={191}
              height={149}
              className="object-contain w-auto h-full max-w-[60%] sm:max-w-[50%] md:max-w-[291px] max-h-[15vh] md:-mr-21"
            />
          </div>
          <div className="w-full flex justify-center flex-shrink-0 px-4">
            <Image
              src="/gears.png"
              alt="Gears"
              width={267}
              height={380}
              className="object-contain w-auto h-full max-w-[50%] sm:max-w-[40%] md:max-w-[200px] max-h-[30vh] md:-mr-18"
            />
          </div>
          <div className="w-full flex justify-center flex-shrink-0 min-h-0 items-end px-4">
            <Image
              src="/robot.png"
              alt="Robot"
              width={300}
              height={300}
              priority
              className="object-contain w-auto h-full max-w-[100%] md:max-w-[300px] max-h-[45vh] md:max-h-[45vh] relative -mr-4 md:-mr-25"
            />
          </div>
        </div>

        <div className="flex md:hidden justify-center py-6 sm:py-8 shrink-0">
          <Image
            src="/logo.png"
            alt="SkyeGPT logo"
            width={191}
            height={149}
            className="w-auto h-auto max-w-[150px] max-h-[100px] sm:max-h-[120px]"
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 pb-4 md:pb-0">
          <div className="flex flex-col min-h-0 pt-0 sm:pt-2 md:pt-15 pb-4 sm:pb-6 w-full h-full">
            <div className="flex flex-col">
              <div className="flex-1 bg-white shadow-lg rounded-[30px] sm:rounded-[40px] p-0 min-h-0 overflow-hidden">
                <div className="h-full">
                  <ChatBox
                    askEndpoint={askEndpointChat}
                    model={model}
                    provider={provider}
                    setProvider={setProvider}
                    messages={chatMessages[provider] || []}
                    setMessages={handleSetMessages}
                    className="chat-chat-container"
                    title="NextJS-ChatBot"
                  />
                </div>
              </div>
            </div>
          </div>
          <footer className="text-center text-xs sm:text-sm text-gray-600 py-3 sm:py-4 shrink-0">
            NextJS-ChatBot can make mistakes. If you find the answer strange, verify the results and give feedback!
          </footer>
        </div>
      </div>
    </div>
  );
};

export default HomePage;