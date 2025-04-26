'use client';

import React, { useState, useEffect, useRef } from 'react';
import { addMessage, createUserMessage, createBotMessage, Message } from '@/app/utils/MessageManager';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import SYSTEM_PROMPT from '@/app/config/systemPrompt';

export interface ChatBoxProps {
  title: string;
  askEndpoint: string;
  model: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  className: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ askEndpoint, model, messages, setMessages, className }) => {
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => addMessage(prev, createUserMessage(input)));
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    try {
      const ollamaMessages = [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...messages.map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      setMessages((prev) => addMessage(prev, createBotMessage('')));

      const response = await fetch(askEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: ollamaMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                fullMessage += data.message.content;

                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = createBotMessage(fullMessage);
                  return newMessages;
                });
              }
            } catch (parseError) {
              console.error('Error parsing stream chunk:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setMessages((prev) => addMessage(prev, createBotMessage('Error: Could not get a response.')));
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
        return  <span className='bg-gray-100 p-4 border border-gray-300 font-mono text-sm overflow-x-auto'>{children}</span>
      }

      const handleCopy = () => {
        navigator.clipboard.writeText(content);
        alert('Code copied to clipboard!');
      };

      return (
        <div className="my-4 relative">
          {language && (
            <div className="absolute top-2 left-2 text-xs text-gray-400 font-mono capitalize">
              {language}
            </div>
          )}
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
      <div
        className="chatMessages flex flex-col gap-8 p-8 max-h-[570px] overflow-y-auto scroll-smooth"
        ref={chatContainerRef}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.sender === 'user'
                ? 'userMessage bg-[#6763bb] self-end py-5 px-8 rounded-[50px_50px_0px_50px] max-w-[80%] text-white'
                : 'botMessage bg-[#e5e5e5] self-start py-5 px-6 rounded-[50px_50px_50px_0] max-w-[80%] text-black'
            }
          >
            {msg.sender === 'bot' ? (
              <div className="flex flex-col">
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
                    table: ({ children }) => <table className="border-collapse border border-gray-300 my-4">{children}</table>,
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