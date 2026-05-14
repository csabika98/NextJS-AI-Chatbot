'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import ChatBox from '@/app/components/ChatBox';
import { Message, Provider } from '@/app/utils/MessageManager';

export type ProviderConfig = Record<Provider, { enabled: boolean; model: string }>;

interface HomePageClientProps {
  providerConfig: ProviderConfig;
  initialProvider: Provider | null;
}

const providerLabels: Record<Provider, string> = {
  ollama: 'Ollama',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
};

const HomePageClient = ({ providerConfig, initialProvider }: HomePageClientProps) => {
  const [chatMessages, setChatMessages] = useState<Record<Provider, Message[]>>({
    ollama: [],
    openai: [],
    deepseek: [],
  });
  const [provider, setProvider] = useState<Provider>(initialProvider || 'ollama');

  const askEndpointChat = '/api/chat';
  const enabledProviders = (Object.keys(providerConfig) as Provider[]).filter(
    (providerKey) => providerConfig[providerKey].enabled
  );
  const activeProvider = providerConfig[provider]?.enabled ? provider : initialProvider;
  const model = activeProvider ? providerConfig[activeProvider].model : '';

  const handleSetMessages = (newMessages: Message[]) => {
    if (!activeProvider) return;

    setChatMessages((prev) => {
      const updatedMessages = Array.isArray(newMessages) ? newMessages : prev[activeProvider] || [];
      return {
        ...prev,
        [activeProvider]: updatedMessages,
      };
    });
  };

  if (!activeProvider || enabledProviders.length === 0) {
    return (
      <div className="w-screen min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-red-600 text-xl text-center max-w-2xl">
          Configure at least one provider: Ollama host and model, OpenAI API key and model, or DeepSeek API key.
        </div>
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
              alt="NextJS-AI-Chatbot"
              width={191}
              height={149}
              priority
              loading="eager"
              sizes="(min-width: 768px) 175px, 150px"
              className="object-contain w-auto h-auto max-w-[60%] sm:max-w-[50%] md:max-w-[291px] max-h-[15vh] md:-mr-21"
            />
          </div>
          <div className="w-full flex justify-center flex-shrink-0 px-4">
            <Image
              src="/gears.png"
              alt="Gears"
              width={267}
              height={380}
              priority
              loading="eager"
              sizes="(min-width: 768px) 200px, 120px"
              className="object-contain w-auto h-auto max-w-[50%] sm:max-w-[40%] md:max-w-[200px] max-h-[30vh] md:-mr-18"
            />
          </div>
          <div className="w-full flex justify-center flex-shrink-0 min-h-0 items-end px-4">
            <Image
              src="/robot.png"
              alt="Robot"
              width={300}
              height={300}
              priority
              loading="eager"
              sizes="(min-width: 768px) 300px, 180px"
              className="object-contain w-auto h-auto max-w-[100%] md:max-w-[300px] max-h-[45vh] md:max-h-[45vh] relative -mr-4 md:-mr-25"
            />
          </div>
        </div>

        <div className="flex md:hidden justify-center py-6 sm:py-8 shrink-0">
          <Image
            src="/logo.png"
            alt="NextJS-AI-Chatbot logo"
            width={191}
            height={149}
            priority
            loading="eager"
            sizes="150px"
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
                    provider={activeProvider}
                    setProvider={setProvider}
                    availableProviders={enabledProviders}
                    providerLabels={providerLabels}
                    messages={chatMessages[activeProvider] || []}
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

export default HomePageClient;
