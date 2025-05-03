'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Image from 'next/image';
import { createUserMessage, createBotMessage, Message } from '@/app/utils/MessageManager';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import SYSTEM_PROMPT from '@/app/config/systemPrompt';
import { debounce } from 'lodash';

const preprocessMarkdown = (markdown: string): string => {
  const inlineCodeRegex = /```(\w*?)\n?([^\n`]+)\n?```/g;
  return markdown.replace(inlineCodeRegex, (match, lang, content) => {
    if (!lang && !content.includes('\n')) {
      return `\`${content}\``;
    }
    return match;
  });
};

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
  const [feedbackError, setFeedbackError] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');
  const [ratingError, setRatingError] = useState<{ [key: number]: string }>({});
  const [feedbackState, setFeedbackState] = useState<{
    ollama: { [key: number]: 'thumbs-up' | 'thumbs-down' | null };
    openai: { [key: number]: 'thumbs-up' | 'thumbs-down' | null };
  }>({
    ollama: {},
    openai: {},
  });
  const [submittedFeedback, setSubmittedFeedback] = useState<{
    ollama: { [key: number]: boolean };
    openai: { [key: number]: boolean };
  }>({
    ollama: {},
    openai: {},
  });
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaContRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasNearBottomRef = useRef<boolean>(true);

  const scrollToBottom = useCallback(
    debounce(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100),
    []
  );

  const textareaResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '50px';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.addEventListener('input', textareaResize);
    }
    return () => {
      if (textarea) {
        textarea.removeEventListener('input', textareaResize);
      }
    };
  }, [textareaResize]);

  useEffect(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      wasNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    }
    if (wasNearBottomRef.current || messages[messages.length - 1]?.sender === 'user') {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

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

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const formattedInput = formatInput(input);
    const userMessage = createUserMessage(formattedInput);
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '50px';
    }
    setIsLoading(true);
    wasNearBottomRef.current = true;

    try {
      const messagesPayload = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages.map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: input },
      ];

      const initialBotMessage = createBotMessage('', provider, model);
      const newMessagesWithBot = [...newMessages, initialBotMessage];
      setMessages(newMessagesWithBot);

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
          const updatedMessages = [...newMessages, botMessage];
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
          const updatedMessages = [...newMessages, botMessage];
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
                  setMessages([...newMessages, botMessage]);
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
                  setMessages([...newMessages, botMessage]);
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
      const updatedMessages = [...messages, errorMessage];
      setMessages(updatedMessages);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, provider, model, setMessages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
        e.preventDefault();
        sendMessage();
      }
    },
    [input, sendMessage]
  );

  const handleFeedback = useCallback(
    async (messageIndex: number, feedback: 'thumbs-up' | 'thumbs-down') => {
      if (submittedFeedback[provider][messageIndex]) return;

      setRatingError((prev) => ({ ...prev, [messageIndex]: '' }));

      try {
        const response = await fetch('/api/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_index: messageIndex,
            rating: feedback,
            provider,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        setFeedbackState((prev) => {
          const currentFeedback = prev[provider][messageIndex];
          const newFeedback = currentFeedback === feedback ? null : feedback;
          return {
            ...prev,
            [provider]: { ...prev[provider], [messageIndex]: newFeedback },
          };
        });
      } catch (error) {
        console.error('Error submitting rating:', error);
        const errorMessage =
          error instanceof Error && error.message.includes('Failed to fetch')
            ? 'Failed to connect to the server. Please try again later.'
            : 'An error occurred while submitting rating. Please try again.';
        setRatingError((prev) => ({ ...prev, [messageIndex]: errorMessage }));
      }
    },
    [provider, submittedFeedback]
  );

  const handleFeedbackPromptClick = useCallback(
    (messageIndex: number) => {
      setActiveMessageIndex(messageIndex);
      setFeedbackError('');
      setSubmitError('');
      if (submittedFeedback[provider][messageIndex]) {
        setIsAlreadySentModalOpen(true);
        return;
      }
      if (!(messageIndex in feedbackState[provider]) || feedbackState[provider][messageIndex] === null) {
        setIsErrorModalOpen(true);
        return;
      }
      setIsModalOpen(true);
    },
    [provider, feedbackState, submittedFeedback]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setFeedbackText('');
    setFeedbackError('');
    setSubmitError('');
  }, []);

  const handleFeedbackSubmit = useCallback(async () => {
    if (activeMessageIndex === null) return;

    if (!feedbackText.trim()) {
      setFeedbackError('Feedback cannot be empty.');
      return;
    }

    const feedbackRating = feedbackState[provider][activeMessageIndex];
    if (!feedbackRating) return;

    const feedbackMessage = messages[activeMessageIndex];
    let precedingQuestion = null;
    if (activeMessageIndex > 0 && messages[activeMessageIndex - 1].sender === 'user') {
      precedingQuestion = messages[activeMessageIndex - 1].text;
    }

    const feedbackData = {
      message: feedbackMessage.text,
      question: precedingQuestion,
      rating: feedbackRating,
      feedbackText: feedbackText.trim(),
      operatingSystem: navigator.userAgent,
      provider,
    };

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      setSubmittedFeedback((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          [activeMessageIndex]: true,
        },
      }));
      handleModalClose();
      setIsConfirmationModalOpen(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      const errorMessage =
        error instanceof Error && error.message.includes('Failed to fetch')
          ? 'Failed to connect to the server. Please try again later.'
          : 'An error occurred while submitting feedback. Please try again.';
      setSubmitError(errorMessage);
    }
  }, [activeMessageIndex, feedbackText, feedbackState, provider, messages, handleModalClose]);

  const handleConfirmationModalClose = useCallback(() => {
    setIsConfirmationModalOpen(false);
    setActiveMessageIndex(null);
  }, []);

  const handleErrorModalClose = useCallback(() => {
    setIsErrorModalOpen(false);
  }, []);

  const handleAlreadySentModalClose = useCallback(() => {
    setIsAlreadySentModalOpen(false);
  }, []);

  const getModalHeader = useCallback(() => {
    if (activeMessageIndex === null) return 'Share your feedback';
    const feedback = feedbackState[provider][activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Report an Issue' : 'Share your feedback';
  }, [activeMessageIndex, feedbackState, provider]);

  const getTextareaPlaceholder = useCallback(() => {
    if (activeMessageIndex === null) return 'write your feedback here...';
    const feedback = feedbackState[provider][activeMessageIndex];
    return feedback === 'thumbs-down' ? 'write your issue here...' : 'write your feedback here...';
  }, [activeMessageIndex, feedbackState, provider]);

  const getConfirmationMessage = useCallback(() => {
    if (activeMessageIndex === null) return 'Feedback Sent!';
    const feedback = feedbackState[provider][activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Report Sent!' : 'Feedback Sent!';
  }, [activeMessageIndex, feedbackState, provider]);

  const getAlreadySentMessage = useCallback(() => {
    if (activeMessageIndex === null) return 'Feedback already sent, Thanks';
    const feedback = feedbackState[provider][activeMessageIndex];
    return feedback === 'thumbs-down' ? 'Issue report already sent, Thanks' : 'Feedback already sent, Thanks';
  }, [activeMessageIndex, feedbackState, provider]);

  const CodeComponent = memo(
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

  return (
    <div className={`flex flex-col gap-4 justify-between ${className}`}>
      <style jsx>{`
        .tint-blue {
          filter: brightness(0) saturate(100%) invert(60%) sepia(90%) saturate(1500%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}</style>
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
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((msg, index) => (
            <MemoizedMessage
              key={index}
              msg={msg}
              index={index}
              isLoading={isLoading}
              provider={msg.provider || provider}
              feedbackState={feedbackState}
              submittedFeedback={submittedFeedback}
              ratingError={ratingError}
              handleFeedback={handleFeedback}
              handleFeedbackPromptClick={handleFeedbackPromptClick}
              messages={messages}
            />
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
      <div className="flex items-center p-2 sm:p-4 gap-4">
        <div
          className="flex-1 bg-gray-100 p-3 sm:p-2 rounded-[20px] transition-all duration-200 shadow-sm"
          ref={textareaContRef}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input-textarea border-none text-sm sm:text-base text-black resize-none bg-transparent w-full h-[50px] font-[Poppins] placeholder:text-gray-500 focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={textareaResize}
            placeholder="Write your question here..."
          />
        </div>
        <button
          ref={buttonRef}
          className="chat-btn sendBtn border-none cursor-pointer disabled:opacity-50"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          title="Send"
        >
          <Image
            src="/button.png"
            alt="Send Button"
            width={120}
            height={120}
            quality={80}
            style={{ height: 'auto', width: 'auto' }}
            priority
            className="object-contain"
          />
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
            <div className="flex flex-col gap-2">
              <textarea
                className={`w-full h-24 p-3 rounded-[10px] bg-gray-100 text-gray-800 placeholder-gray-500 focus:outline-none resize-none ${
                  feedbackError || submitError ? 'border-2 border-red-500' : ''
                }`}
                placeholder={getTextareaPlaceholder()}
                value={feedbackText}
                onChange={(e) => {
                  setFeedbackText(e.target.value);
                  setFeedbackError('');
                  setSubmitError('');
                }}
                aria-invalid={feedbackError || submitError ? 'true' : 'false'}
                aria-describedby={
                  feedbackError ? 'feedback-error' : submitError ? 'submit-error' : undefined
                }
              />
              {feedbackError && (
                <p id="feedback-error" className="text-red-500 text-sm">
                  {feedbackError}
                </p>
              )}
              {submitError && (
                <p id="submit-error" className="text-red-500 text-sm">
                  {submitError}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleFeedbackSubmit}
                className={`px-6 py-2 rounded-full text-white transition-colors duration-200 ${
                  feedbackText.trim()
                    ? 'bg-[#3399FF] hover:bg-[#287acc]'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={!feedbackText.trim()}
                aria-label="Send Feedback"
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
                className="h-12 w-12 text-[#3399FF]"
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
                {activeMessageIndex !== null
                  ? 'Please rate the message first with either a thumbs-up or thumbs-down.'
                  : 'Failed to submit feedback. Please try again.'}
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

const MemoizedMessage = memo(
  ({
    msg,
    index,
    isLoading,
    provider,
    feedbackState,
    submittedFeedback,
    ratingError,
    handleFeedback,
    handleFeedbackPromptClick,
    messages,
  }: {
    msg: Message;
    index: number;
    isLoading: boolean;
    provider: string;
    feedbackState: {
      ollama: { [key: number]: 'thumbs-up' | 'thumbs-down' | null };
      openai: { [key: number]: 'thumbs-up' | 'thumbs-down' | null };
    };
    submittedFeedback: {
      ollama: { [key: number]: boolean };
      openai: { [key: number]: boolean };
    };
    ratingError: { [key: number]: string };
    handleFeedback: (messageIndex: number, feedback: 'thumbs-up' | 'thumbs-down') => void;
    handleFeedbackPromptClick: (messageIndex: number) => void;
    messages: Message[];
  }) => {
    const messageProvider = (msg.provider || provider) as 'ollama' | 'openai';

    return (
      <div className="flex flex-col">
        {msg.sender === 'user' ? (
          <div
            className={`p-4 sm:p-5 md:p-6 rounded-[30px] max-w-[90%] sm:max-w-[80%] transition-opacity duration-300 bg-gradient-to-r from-[#3399FF] to-[#287acc] self-end text-white rounded-tl-[30px] rounded-br-[0]`}
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
                    code: ({ inline, className, children, ...props }: {
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
                    },
                    p: ({ children }) => {
                      const hasBlockCode = React.Children.toArray(children).some(
                        (child) =>
                          React.isValidElement(child) &&
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
            {(index !== messages.length - 1 || !isLoading) && (
              <div className="flex flex-col items-end gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFeedbackPromptClick(index)}
                    className="text-xs text-gray-600 hover:text-gray-800 transition-colors duration-200"
                    title="Give Feedback"
                  >
                    GIVE FEEDBACK
                  </button>
                  <button
                    onClick={() => handleFeedback(index, 'thumbs-up')}
                    disabled={submittedFeedback[messageProvider][index] || false}
                    className={`transition-all duration-200 transform ${
                      submittedFeedback[messageProvider][index]
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:scale-125 hover:opacity-100'
                    } ${
                      feedbackState[messageProvider][index] === 'thumbs-up' ? 'opacity-100 tint-blue' : 'opacity-60'
                    }`}
                    title="Thumbs Up"
                    aria-label="Thumbs Up"
                    aria-describedby={ratingError[index] ? `rating-error-${index}` : undefined}
                  >
                    <Image
                      src="/tup.png"
                      alt="Thumbs Up"
                      width={16}
                      height={16}
                      style={{ height: 'auto', width: 'auto' }}
                      priority
                      className={feedbackState[messageProvider][index] === 'thumbs-up' ? 'tint-blue' : ''}
                    />
                  </button>
                  <button
                    onClick={() => handleFeedback(index, 'thumbs-down')}
                    disabled={submittedFeedback[messageProvider][index] || false}
                    className={`transition-all duration-200 transform ${
                      submittedFeedback[messageProvider][index]
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:scale-125 hover:opacity-100'
                    } ${
                      feedbackState[messageProvider][index] === 'thumbs-down' ? 'opacity-100 tint-blue' : 'opacity-60'
                    }`}
                    title="Thumbs Down"
                    aria-label="Thumbs Down"
                    aria-describedby={ratingError[index] ? `rating-error-${index}` : undefined}
                  >
                    <Image
                      src="/tdown.png"
                      alt="Thumbs Down"
                      width={16}
                      height={16}
                      style={{ height: 'auto', width: 'auto' }}
                      priority
                      className={feedbackState[messageProvider][index] === 'thumbs-down' ? 'tint-blue' : ''}
                    />
                  </button>
                </div>
                {ratingError[index] && (
                  <p
                    id={`rating-error-${index}`}
                    className="text-red-500 text-xs mt-1"
                    aria-live="polite"
                  >
                    {ratingError[index]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.msg === nextProps.msg &&
      prevProps.index === nextProps.index &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.provider === nextProps.provider &&
      prevProps.feedbackState[(prevProps.msg.provider || prevProps.provider) as 'ollama' | 'openai'][prevProps.index] ===
        nextProps.feedbackState[(nextProps.msg.provider || nextProps.provider) as 'ollama' | 'openai'][nextProps.index] &&
      prevProps.submittedFeedback[(prevProps.msg.provider || prevProps.provider) as 'ollama' | 'openai'][prevProps.index] ===
        nextProps.submittedFeedback[(nextProps.msg.provider || nextProps.provider) as 'ollama' | 'openai'][nextProps.index] &&
      prevProps.ratingError[prevProps.index] === nextProps.ratingError[nextProps.index]
    );
  }
);

export default memo(ChatBox);