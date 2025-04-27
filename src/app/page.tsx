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
    console.log(`Provider changed to: ${provider}`);
    if (provider === 'openai') {
      const openaiModel = process.env.NEXT_PUBLIC_OPENAI_DEFAULT_MODEL;
      const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

      console.log(`OpenAI Config - Model: ${openaiModel}, API Key: ${openaiApiKey ? 'Set' : 'Missing'}`);
      if (!openaiModel || !openaiApiKey) {
        setError('Missing OpenAI configuration: NEXT_PUBLIC_OPENAI_DEFAULT_MODEL and NEXT_PUBLIC_OPENAI_API_KEY are required.');
        return;
      }
      setModel(openaiModel);
      console.log(`Set model to OpenAI: ${openaiModel}`);
    } else {
      const ollamaHost = process.env.NEXT_PUBLIC_OLLAMA_HOST;
      const ollamaModel = process.env.NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME;

      console.log(`Ollama Config - Host: ${ollamaHost}, Model: ${ollamaModel}`);
      if (!ollamaHost || !ollamaModel) {
        setError('Missing Ollama configuration: NEXT_PUBLIC_OLLAMA_HOST and NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME are required.');
        return;
      }
      setModel(ollamaModel);
      console.log(`Set model to Ollama: ${ollamaModel}`);
    }
    setError(null);
    setIsInitialized(true);
  }, [provider]);

  useEffect(() => {
    console.log(`chatMessages state:`, chatMessages);
    console.log(`Current provider: ${provider}, messages:`, chatMessages[provider]);
  }, [chatMessages, provider]);

  const handleSetMessages = (newMessages: Message[]) => {
    console.log(`handleSetMessages called for provider ${provider} with newMessages:`, newMessages);
    setChatMessages((prev) => {
      const updatedMessages = Array.isArray(newMessages) ? newMessages : prev[provider] || [];
      console.log(`Updating chatMessages[${provider}] to:`, updatedMessages);
      const newState = {
        ...prev,
        [provider]: updatedMessages,
      };
      console.log(`New chatMessages state:`, newState);
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
    <div className="w-screen h-screen max-w-full max-h-full">
      <header className="flex justify-between h-[114px] px-12 py-6">
        <Image src="/logo.svg" alt="logo" width={150} height={90} className="h-[90px]" priority />
      </header>
      <div className="h-[calc(100%-114px)]">
        <div className="flex flex-col pt-8 pb-16 h-full mx-auto custom-width">
          <div className="flex flex-col h-full">
            <div className="flex h-[50px] gap-3">
              <div className="bg-[#faebd7] flex justify-center items-center text-xl min-w-[180px] min-h-[50px] rounded-t-[20px] shadow-[0_10px_15px_rgba(0,0,0,0.25)] cursor-pointer active:bg-white p-[10px]">
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