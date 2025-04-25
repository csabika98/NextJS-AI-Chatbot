'use client';

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import ChatBox from '@/app/components/ChatBox';
import { Message } from '@/app/utils/MessageManager';

const HomePage = () => {
  const [chromaMessages, setChromaMessages] = useState<Message[]>([]);
  // i set a fallback for the backend host in case the env variable is not set
  const backendHost = process.env.NEXT_PUBLIC_CHATBOT_BACKEND_HOST || 'http://localhost:8000';

  const askEndpointChroma = `${backendHost}/askChroma`;

  return (
    <div className="w-screen h-screen max-w-full max-h-full">
      <header className="flex justify-between h-[114px] px-12 py-6">
      <Image src="/logo.svg" alt="logo" width={150} height={90} className="h-[90px]" />        
      </header>
      <div className="h-[calc(100%-114px)]">
        <div className="flex flex-col pt-8 pb-16 h-full mx-auto custom-width">
          <div className="flex flex-col h-full">
            <div className="flex h-[50px] gap-3">
                <div
                  className="flex justify-center items-center text-xl bg-white min-w-[180px] min-h-[50px] rounded-t-[20px] shadow-[0_10px_15px_rgba(0,0,0,0.25)] cursor-pointer active:bg-white p-[10px]"
                >
                  Chatbot
                </div>
            </div>
            <div className="flex-1 bg-white shadow-[0_10px_15px_rgba(0,0,0,0.25)] z-[1] rounded-[0_50px_50px_50px] p-8">
              <div className="h-full">
                <ChatBox
                  title="Ask GPT Chroma"
                  askEndpoint={askEndpointChroma}
                  messages={chromaMessages}
                  setMessages={setChromaMessages}
                  className="gptChroma"
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
