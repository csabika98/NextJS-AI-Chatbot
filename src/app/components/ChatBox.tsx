'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createUserMessage, createBotMessage, Message } from '@/app/utils/MessageManager';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import SYSTEM_PROMPT from '@/app/config/systemPrompt';

export interface ChatBoxProps {
  askEndpoint: string;
  model: string;
  provider: 'ollama' | 'openai';
  setProvider: React.Dispatch<React.SetStateAction<'ollama' | 'openai'>>;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  className: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ askEndpoint, model, provider, setProvider, messages, setMessages, className }) => {
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaContRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    textareaResize();
    hitEnter();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, messages]);

  useEffect(() => {
    console.log(`ChatBox messages prop:`, messages);
    console.log(`ChatBox localMessages:`, localMessages);
    setLocalMessages(messages);
  }, [messages]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const hitEnter = () => {
    const sendBtn = document.querySelector('.chat-btn') as HTMLElement | null;
    document.querySelectorAll('.chat-input-textarea').forEach((input) => {
      input.addEventListener('keydown', (e: Event) => {
        if (e instanceof KeyboardEvent && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn?.click();
        }
      });
    });
  };

  const preprocessMarkdown = (markdown: string): string => {
    const inlineCodeRegex = /```(\w*?)\n?([^\n`]+)\n?```/g;
    return markdown.replace(inlineCodeRegex, (match, lang, content) => {
      if (!lang && !content.includes('\n')) {
        return `\`${content}\``;
      }
      return match;
    });
  };

  const handleProviderChange = (newProvider: 'ollama' | 'openai') => {
    console.log(`Changing provider to: ${newProvider}`);
    setProvider(newProvider);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
  
    console.log(`Sending message with provider: ${provider}, model: ${model}`);
    const userMessage = createUserMessage(input);
    const newLocalMessages = [...localMessages, userMessage];
    setLocalMessages(newLocalMessages);
    setMessages(newLocalMessages); 
    setInput('');
    setIsLoading(true);
  
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  
    try {
      const messagesPayload = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newLocalMessages.map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];
  
      const initialBotMessage = createBotMessage('Loading...', provider, model);
      const newLocalMessagesWithBot = [...newLocalMessages, initialBotMessage];
      setLocalMessages(newLocalMessagesWithBot);
      setMessages(newLocalMessagesWithBot); 
  
      const requestBody = {
        model,
        messages: messagesPayload,
        stream: true,
        provider,
      };
  
      console.log(`API Request: ${JSON.stringify(requestBody)}`);
      const response = await fetch(askEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
  
      const contentType = response.headers.get('Content-Type');
      if (contentType && !contentType.includes('text/event-stream')) {
        const data = await response.json();
        console.log(`Non-streaming response:`, data);
        if (data.message && data.message.content) {
          const botMessage = createBotMessage(data.message.content, provider, model);
          const updatedMessages = [...newLocalMessages, botMessage];
          setLocalMessages(updatedMessages);
          setMessages(updatedMessages);
        }
        setIsLoading(false);
        return;
      }
  
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
  
      let fullMessage = '';
      let buffer = '';
  
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log(`Streaming done. Final bot message: ${fullMessage}`);
          const botMessage = createBotMessage(fullMessage || 'No response received', provider, model);
          const updatedMessages = [...newLocalMessages, botMessage];
          setLocalMessages(updatedMessages);
          setMessages(updatedMessages); 
          break;
        }
  
        const chunk = new TextDecoder().decode(value);
        console.log(`Raw stream chunk: ${chunk}`);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
  
        for (const line of lines) {
          if (line.trim()) {
            console.log(`Processing stream line: ${line}`);
            if (provider === 'openai' && line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices && parsed.choices[0].delta.content) {
                  fullMessage += parsed.choices[0].delta.content;
                  const botMessage = createBotMessage(fullMessage, provider, model);
                  setLocalMessages([...newLocalMessages, botMessage]);
                }
              } catch (parseError) {
                console.error(`Error parsing OpenAI stream line: ${parseError}, line: ${data}`);
                continue;
              }
            } else if (provider === 'ollama') {
              try {
                const parsed = JSON.parse(line);
                if (parsed.message && parsed.message.content) {
                  fullMessage += parsed.message.content;
                  // Update only localMessages for interim updates
                  const botMessage = createBotMessage(fullMessage, provider, model);
                  setLocalMessages([...newLocalMessages, botMessage]);
                }
              } catch (parseError) {
                console.error(`Error parsing Ollama stream line: ${parseError}, line: ${line}`);
                continue;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      const errorMessage = createBotMessage(`Error: ${(error as Error).message}`, provider, model);
      const updatedMessages = [...newLocalMessages, errorMessage];
      setLocalMessages(updatedMessages);
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const CodeComponent = React.memo(
    ({
      inline,
      className,
      children,
      ...props
    }: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
      [key: string]: any;
    }) => {
      const cleanProps = { ...props };
      delete cleanProps.node;

      const content = String(children).replace(/\n$/, '');
      const isSingleLine = !content.includes('\n');
      const match = className?.match(/language-(\w+)/);
      const language = match ? match[1] : null;

      if (inline || (isSingleLine && !language)) {
        return <span><b>{children}</b></span>;
      }

      const handleCopy = () => {
        navigator.clipboard.writeText(content);
        alert('Code copied to clipboard!');
      };

      return (
        <div className="my-4 relative">
          {language && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-700 px-2 py-1 rounded"
            >
              Copy
            </button>
          )}
          {language ? (
            <SyntaxHighlighter
              language={language}
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                overflowX: 'auto',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
              codeTagProps={{
                className: 'font-mono',
                ...cleanProps,
              }}
            >
              {content}
            </SyntaxHighlighter>
          ) : (
            <pre
              className="bg-gray-800 text-white font-mono text-sm p-4 rounded-lg shadow-md overflow-x-auto"
              {...cleanProps}
            >
              <code>{children}</code>
            </pre>
          )}
        </div>
      );
    }
  );

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
      <div className="flex flex-col gap-4 p-4">
        <label>
          Provider:
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as 'ollama' | 'openai')}
            className="ml-2 p-1 border rounded"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
      </div>
      <div
        className="chatMessages flex flex-col gap-4 p-4 sm:p-6 md:p-8 overflow-y-auto scroll-smooth bg-white rounded-[20px] h-[60vh] max-h-[60vh]"
        ref={chatContainerRef}
      >
        {Array.isArray(localMessages) && localMessages.length > 0 ? (
          localMessages.map((msg, index) => (
            <div
              key={index}
              className={
                msg.sender === 'user'
                  ? 'userMessage bg-[#6763bb] self-end py-5 px-8 rounded-[50px_50px_0px_50px] max-w-[80%] text-white'
                  : msg.provider === 'openai'
                  ? 'botMessage bg-[#d1e7ff] self-start py-5 px-6 rounded-[50px_50px_50px_0] max-w-[80%] text-black'
                  : 'botMessage bg-[#d1ffd1] self-start py-5 px-6 rounded-[50px_50px_50px_0] max-w-[80%] text-black'
              }
            >
              {msg.sender === 'bot' ? (
                <div className="flex flex-col">
                  <div className="text-xs text-gray-600 mb-2">
                    {msg.provider === 'openai'
                      ? `OpenAI (${msg.model || 'Unknown'})`
                      : `Ollama (${msg.model || 'Unknown'})`}
                  </div>
                  <ReactMarkdown
                    remarkPlugins={[remarkBreaks, remarkGfm]}
                    components={{
                      ol: ({ children }) => <div className="not-last:pb-6">{children}</div>,
                      ul: ({ children }) => <div className="not-last:pb-6">{children}</div>,
                      li: ({ children }) => <div className="pb-1">{children}</div>,
                      code: CodeComponent,
                      p: ({ children }) => {
                        const hasBlockCode = React.Children.toArray(children).some(
                          (child) =>
                            React.isValidElement(child) &&
                            child.type === CodeComponent &&
                            !(child as React.ReactElement<{ inline?: boolean }>).props.inline
                        );
                        if (hasBlockCode) {
                          return <>{children}</>;
                        }
                        return <p className="not-last:pb-1 last:pb-1">{children}</p>;
                      },
                      h3: ({ children }) => <h3 className="text-xl font-bold mb-4 pb-1 text-black">{children}</h3>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 pb-1 text-black">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold mb-4 pb-1 text-black">{children}</h2>,
                      table: ({ children }) => (
                        <table className="border-collapse border border-gray-300 my-4">{children}</table>
                      ),
                      th: ({ children }) => <th className="border border-gray-300 px-4 py-2 bg-gray-100">{children}</th>,
                      td: ({ children }) => <td className="border border-gray-300 px-4 py-2">{children}</td>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      a: ({ href, children }) => (
                        <a href={href} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {preprocessMarkdown(msg.text.replace(/\\n/g, '\n'))}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-base text-white">{msg.text}</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-gray-600 text-center">No messages yet.</div>
        )}
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
            className="chat-input-textarea border-none text-base text-black resize-none bg-transparent p-0 w-full font-[Poppins] min-h-[30px] placeholder:text-base focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write your question here..."
          />
        </div>
        <button
          className="chat-btn sendBtn h-[50px] w-[100px] text-xl text-white bg-[#6763bb] rounded-full border-none cursor-pointer"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBox;