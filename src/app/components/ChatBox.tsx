'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<boolean>(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [isAlreadySentModalOpen, setIsAlreadySentModalOpen] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackState, setFeedbackState] = useState<{ [key: number]: 'thumbs-up' | 'thumbs-down' | null }>({});
  const [submittedFeedback, setSubmittedFeedback] = useState<{ [key: number]: boolean }>({});
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaContRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef<boolean>(true);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    textareaResize();
    hitEnter();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      wasNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }

    const raf = requestAnimationFrame(() => {
      if (wasNearBottomRef.current || localMessages[localMessages.length - 1]?.sender === 'user') {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [localMessages]);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
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

  const isCodeInput = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      return true; 
    }
    return (
      trimmed.includes(';') ||
      trimmed.includes('=>') ||
      trimmed.includes('{') ||
      trimmed.includes('}') ||
      trimmed.includes('\n') ||
      /^function\s/.test(trimmed) ||
      /^const\s/.test(trimmed) ||
      /^let\s/.test(trimmed) ||
      /^var\s/.test(trimmed) ||
      /^import\s/.test(trimmed)
    );
  };

  const formatInput = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      return trimmed; 
    }
    if (isCodeInput(trimmed)) {
      return '```javascript\n' + trimmed + '\n```';
    }
    return text;
  };

  const handleProviderChange = (newProvider: 'ollama' | 'openai') => {
    setProvider(newProvider);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const formattedInput = formatInput(input);
    const userMessage = createUserMessage(formattedInput);
    const newLocalMessages = [...localMessages, userMessage];
    setLocalMessages(newLocalMessages);
    setMessages(newLocalMessages);
    setInput('');
    if (textareaContRef.current) {
      textareaContRef.current.style.height = 'auto';
    }
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

      const initialBotMessage = createBotMessage('', provider, model);
      const newLocalMessagesWithBot = [...newLocalMessages, initialBotMessage];
      setLocalMessages(newLocalMessagesWithBot);
      setMessages(newLocalMessagesWithBot);

      const requestBody = {
        model,
        messages: messagesPayload,
        stream: true,
        provider,
      };

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
          const botMessage = createBotMessage(fullMessage || 'No response received', provider, model);
          const updatedMessages = [...newLocalMessages, botMessage];
          setLocalMessages(updatedMessages);
          setMessages(updatedMessages);
          break;
        }

        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
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
                continue;
              }
            } else if (provider === 'ollama') {
              try {
                const parsed = JSON.parse(line);
                if (parsed.message && parsed.message.content) {
                  fullMessage += parsed.message.content;
                  const botMessage = createBotMessage(fullMessage, provider, model);
                  setLocalMessages([...newLocalMessages, botMessage]);
                }
              } catch (parseError) {
                continue;
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = createBotMessage(`Error: ${(error as Error).message}`, provider, model);
      const updatedMessages = [...newLocalMessages, errorMessage];
      setLocalMessages(updatedMessages);
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageIndex: number, feedback: 'thumbs-up' | 'thumbs-down') => {
    if (submittedFeedback[messageIndex]) {
      return;
    }
    setFeedbackState((prev) => {
      const currentFeedback = prev[messageIndex];
      const newFeedback = currentFeedback === feedback ? null : feedback;
      return { ...prev, [messageIndex]: newFeedback };
    });
  };

  const handleFeedbackPromptClick = (messageIndex: number) => {
    setActiveMessageIndex(messageIndex);
    if (submittedFeedback[messageIndex]) {
      setIsAlreadySentModalOpen(true);
      return;
    }
    if (!(messageIndex in feedbackState) || feedbackState[messageIndex] === null) {
      setIsErrorModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setFeedbackText('');
  };

  const handleFeedbackSubmit = () => {
    if (activeMessageIndex !== null) {
      setSubmittedFeedback((prev) => ({
        ...prev,
        [activeMessageIndex]: true,
      }));
    }
    handleModalClose();
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmationModalClose = () => {
    setIsConfirmationModalOpen(false);
    setActiveMessageIndex(null);
  };

  const handleErrorModalClose = () => {
    setIsErrorModalOpen(false);
  };

  const handleAlreadySentModalClose = () => {
    setIsAlreadySentModalOpen(false);
  };

  const getModalHeader = () => {
    if (activeMessageIndex === null) return 'Share your feedback';
    const feedback = feedbackState[activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Report an Issue' : 'Share your feedback';
  };

  const getTextareaPlaceholder = () => {
    if (activeMessageIndex === null) return 'write your feedback here...';
    const feedback = feedbackState[activeMessageIndex];
    return feedback === 'thumbs-down' ? 'write your issue here...' : 'write your feedback here...';
  };

  const getConfirmationMessage = () => {
    if (activeMessageIndex === null) return 'Feedback Sent!';
    const feedback = feedbackState[activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Report Sent!' : 'Feedback Sent!';
  };

  const getAlreadySentMessage = () => {
    if (activeMessageIndex === null) return 'Feedback already sent, Thanks';
    const feedback = feedbackState[activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Issue report already sent, Thanks' : 'Feedback already sent, Thanks';
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
      const resize = () => {
        textareaCont.style.height = 'auto';
        textareaCont.style.height = `${Math.min(textarea.scrollHeight + 20, 150)}px`;
      };
      textarea.addEventListener('input', resize);
      resize();
      return () => textarea.removeEventListener('input', resize);
    }
  };

  return (
    <div className={`flex flex-col gap-4 justify-between ${className}`}>
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
        className="chatMessages flex flex-col gap-6 p-4 sm:p-6 md:p-8 overflow-y-auto scroll-smooth bg-white rounded-[20px] h-[60vh] max-h-[60vh]"
        ref={chatContainerRef}
      >
        {Array.isArray(localMessages) && localMessages.length > 0 ? (
          localMessages.map((msg, index) => (
            <div key={index} className="flex flex-col">
              {msg.sender === 'user' ? (
                <div
                  className={`p-4 sm:p-5 md:p-6 rounded-[30px] max-w-[90%] sm:max-w-[80%] transition-opacity duration-300 bg-gradient-to-r from-[#1ea974] to-[#17a267] self-end text-white rounded-tl-[30px] rounded-br-[0]`}
                >
                  <div className="text-sm sm:text-base">{msg.text}</div>
                </div>
              ) : (
                <div className="self-start max-w-[90%] sm:max-w-[80%] flex flex-col">
                  <div
                    className={`p-4 sm:p-5 md:p-6 rounded-[30px] transition-opacity duration-300 bg-[#ececec] text-black rounded-tr-[30px] rounded-bl-[0] shadow-sm`}
                  >
                    <div className="flex flex-col">
                      <div className="text-xs text-gray-600 mb-2">
                        {msg.provider === 'openai'
                          ? `OpenAI (${msg.model || 'Unknown'})`
                          : `Ollama (${msg.model || 'Unknown'})`}
                      </div>
                      <ReactMarkdown
                        remarkPlugins={[remarkBreaks, remarkGfm]}
                        components={{
                          ol: ({ children }) => <ol className="pl-6 sm:pl-8 list-decimal">{children}</ol>,
                          ul: ({ children }) => <ul className="pl-6 sm:pl-8 list-disc">{children}</ul>,
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
                            return <p className="mb-2">{children}</p>;
                          },
                          h3: ({ children }) => <h3 className="text-lg sm:text-xl font-semibold mb-3 text-black">{children}</h3>,
                          h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-black">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-xl font-bold mb-4 text-black">{children}</h2>,
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
                  </div>
                  {(index !== localMessages.length - 1 || !isLoading) && (
                    <div className="flex items-center gap-2 mt-2 self-end">
                      <button
                        onClick={() => handleFeedbackPromptClick(index)}
                        className="text-xs text-gray-600 hover:text-gray-800 transition-colors duration-200"
                        title="Give Feedback"
                      >
                        GIVE FEEDBACK
                      </button>
                      <button
                        onClick={() => handleFeedback(index, 'thumbs-up')}
                        disabled={submittedFeedback[index] || false}
                        className={`transition-all duration-200 transform ${
                          submittedFeedback[index]
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:scale-125 hover:opacity-100'
                        } ${
                          feedbackState[index] === 'thumbs-up' ? 'opacity-100 tint-green' : 'opacity-60'
                        }`}
                        title="Thumbs Up"
                        aria-label="Thumbs Up"
                      >
                        <Image src="/tup.png" alt="Thumbs Up" width={16} height={16} className={feedbackState[index] === 'thumbs-up' ? 'tint-green' : ''} />
                      </button>
                      <button
                        onClick={() => handleFeedback(index, 'thumbs-down')}
                        disabled={submittedFeedback[index] || false}
                        className={`transition-all duration-200 transform ${
                          submittedFeedback[index]
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:scale-125 hover:opacity-100'
                        } ${
                          feedbackState[index] === 'thumbs-down' ? 'opacity-100 tint-green' : 'opacity-60'
                        }`}
                        title="Thumbs Down"
                        aria-label="Thumbs Down"
                      >
                        <Image src="/tdown.png" alt="Thumbs Down" width={16} height={16} className={feedbackState[index] === 'thumbs-down' ? 'tint-green' : ''} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-gray-600 text-center">No messages yet.</div>
        )}
        {isLoading && (
          <div className="loading flex justify-center items-center p-4">
            <div className="animate-pulse flex space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        )}
      </div>
      <div className="relative p-2 sm:p-4">
        <div
          className="flex flex-1 bg-gray-100 p-3 sm:p-4 pr-32 sm:pr-36 rounded-[20px] transition-all duration-200 max-h-[150px] shadow-sm"
          ref={textareaContRef}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input-textarea border-none text-sm sm:text-base text-black resize-none bg-transparent w-full font-[Poppins] min-h-[40px] placeholder:text-gray-500 focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write your question here..."
          />
        </div>
        <button
          className="chat-btn sendBtn absolute right-[-29px] sm:right-[-10px] top-1/2 transform -translate-y-1/2 border-none cursor-pointer disabled:opacity-50"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          title="Send"
        >
          <Image src="/button.png" alt="Send Button" width={120} height={120} />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50">
          <div className="bg-white rounded-[20px] shadow-lg p-6 w-[90%] max-w-[500px] flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-center flex-1">{getModalHeader()}</h2>
              <button
                onClick={handleModalClose}
                className="text-gray-600 hover:text-gray-800 text-xl"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>
            <textarea
              className="w-full h-24 p-3 rounded-[10px] bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none resize-none"
              placeholder={getTextareaPlaceholder()}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={handleFeedbackSubmit}
                className="bg-[#1ea974] text-white px-6 py-2 rounded-full hover:bg-[#17a267] transition-colors duration-200"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmationModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50">
          <div className="bg-white rounded-[20px] shadow-lg p-6 w-[90%] max-w-[400px] flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-center flex-1">{getModalHeader()}</h2>
              <button
                onClick={handleConfirmationModalClose}
                className="text-gray-600 hover:text-gray-800 text-xl"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-[#17a267]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg font-bold text-center">{getConfirmationMessage()}</p>
              <p className="text-center text-gray-600">Thanks</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleConfirmationModalClose}
                className="text-gray-600 underline hover:text-gray-800 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isErrorModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50">
          <div className="bg-white rounded-[20px] shadow-lg p-6 w-[90%] max-w-[400px] flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-center flex-1">Error</h2>
              <button
                onClick={handleErrorModalClose}
                className="text-gray-600 hover:text-gray-800 text-xl"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-gray-600">
                Please rate the message first with either a thumbs-up or thumbs-down.
              </p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleErrorModalClose}
                className="text-gray-600 underline hover:text-gray-800 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAlreadySentModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50">
          <div className="bg-white rounded-[20px] shadow-lg p-6 w-[90%] max-w-[400px] flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-center flex-1">Feedback Status</h2>
              <button
                onClick={handleAlreadySentModalClose}
                className="text-gray-600 hover:text-gray-800 text-xl"
                aria-label="Close Modal"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-center text-gray-600">{getAlreadySentMessage()}</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleAlreadySentModalClose}
                className="text-gray-600 underline hover:text-gray-800 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;