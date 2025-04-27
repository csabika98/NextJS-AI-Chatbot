'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import ChatBox from '@/app/components/ChatBox';
import { Message } from '@/app/utils/MessageManager';

const HomePage = () => {
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const modelName = process.env.NEXT_PUBLIC_CHATBOT_MODEL_NAME || 'llama3';
  const askEndpointChat = '/api/chat';

  return (
    <div className="w-screen h-screen max-w-full max-h-full">
      <header className="flex justify-between h-[114px] px-12 py-6">
        <Image src="/logo.svg" alt="logo" width={150} height={90} className="h-[90px]" />
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
                model={modelName}
                messages={chatMessages}
                setMessages={setChatMessages}
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