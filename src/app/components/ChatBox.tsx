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

const preprocessUserText = (text: string): string => {
  return text
    .replace(/```[\w]*\n([\s\S]*?)\n```/g, '$1') 
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/^\s{4,}/gm, '');
};

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
      return <span className="font-bold">{children}</span>;
    }

    const handleCopy = () => {
      navigator.clipboard.writeText(content).then(() => {
        alert('Code copied to clipboard!');
      }).catch((err) => {
        console.error('Failed to copy code:', err);
        alert('Failed to copy code. Please try again.');
      });
    };

    return (
      <div className="my-4 relative w-full max-w-full">
        <button
          onClick={handleCopy}
          className="absolute justify-center top-2 right-2-custom text-xs text-gray-400 hover:text-gray-200 bg-gray-700 px-2 py-2 rounded flex items-right gap-1 z-10"
        >
          {language && <span className="capitalize">{language}</span>}
          <span>Copy</span>
        </button>
        <div className="w-full max-w-full overflow-x-auto">
          <SyntaxHighlighter
            language={language || undefined}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              overflowX: 'auto',
              overflowY: 'auto',
              maxHeight: '50vh',
              width: '100%',
              maxWidth: '100%',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              background: 'rgb(40, 44, 52)',
              color: 'rgb(171, 178, 191)',
              textShadow: 'rgba(0, 0, 0, 0.3) 0px 1px',
              boxSizing: 'border-box',
            }}
            codeTagProps={{
              className: 'font-mono',
              style: {
                whiteSpace: 'pre-wrap',
                fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
              },
              ...cleanProps,
            }}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }
);

export interface ChatBoxProps {
  title: string;
  askEndpoint: string;
  model: string;
  provider: 'ollama' | 'openai';
  setProvider: React.Dispatch<React.SetStateAction<'ollama' | 'openai'>>;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  className: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  title,
  askEndpoint,
  model,
  provider,
  setProvider,
  messages,
  setMessages,
  className,
}) => {
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
      const newHeight = Math.min(textarea.scrollHeight, 96);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);



  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      textarea.addEventListener('input', textareaResize);
      textarea.addEventListener('paste', textareaResize);
    }
    return () => {
      if (textarea) {
        textarea.removeEventListener('input', textareaResize);
        textarea.removeEventListener('paste', textareaResize);
      }
    };
  }, [textareaResize]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleProviderChange = (newProvider: 'ollama' | 'openai') => {
    setProvider(newProvider);
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const formattedInput = preprocessUserText(input); 
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
      const updatedMessages = [...newMessages, errorMessage];
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
      const previousFeedback = feedbackState[provider][messageIndex];
      const isToggling = previousFeedback === feedback;

      setFeedbackState((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          [messageIndex]: isToggling ? null : feedback,
        },
      }));
      setRatingError((prev) => ({ ...prev, [messageIndex]: '' }));

      if (isToggling) {
        return;
      }

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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
        }
      } catch (error: unknown) {
        setFeedbackState((prev) => ({
          ...prev,
          [provider]: { ...prev[provider], [messageIndex]: previousFeedback },
        }));
        const errorMessage =
          error instanceof Error && error.message.includes('Failed to fetch')
            ? 'Failed to connect to the server. Please try again later.'
            : error instanceof Error
            ? error.message
            : 'An error occurred while submitting rating. Please try again.';
        setRatingError((prev) => ({ ...prev, [messageIndex]: errorMessage }));
      }
    },
    [provider, feedbackState]
  );

  const debouncedHandleFeedback = useCallback(
    debounce((messageIndex: number, feedback: 'thumbs-up' | 'thumbs-down') => {
      handleFeedback(messageIndex, feedback);
    }, 100),
    [handleFeedback]
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

  return (
    <div className={`flex flex-col gap-4 justify-between ${className}`}>
      <div className="flex flex-col gap-4 p-4">
        <label className="flex items-center gap-2">
          Provider:
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as 'ollama' | 'openai')}
            className="ml-2 p-1 border rounded w-full max-w-[150px]"
          >
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
      </div>
      <div
        className="chatMessages flex flex-col gap-6 p-3 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden scroll-smooth bg-white rounded-[20px] h-[calc(100vh-200px)] sm:h-[60vh] max-h-[calc(100vh-200px)] sm:max-h-[60vh] min-h-[400px] w-full max-w-full box-border"
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
              handleFeedback={debouncedHandleFeedback}
              handleFeedbackPromptClick={handleFeedbackPromptClick}
              messages={messages}
            />
          ))
        ) : (
          <div className="text-gray-600 text-center py-4">No messages yet.</div>
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
      <div className="flex items-center flex-wrap p-2 sm:p-4 gap-4">
        <div
          className="flex-1 bg-gray-100 p-3 sm:p-2 rounded-[20px] transition-all duration-200 shadow-sm max-w-full max-h-[112px]"
          ref={textareaContRef}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input-textarea border-none text-sm sm:text-base text-black resize-none bg-transparent w-full h-[50px] max-h-[96px] font-[Poppins] placeholder:text-gray-500 focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={textareaResize}
            placeholder="Write your question here..."
            maxLength={40000}
          />
        </div>
        <button
          ref={buttonRef}
          className="chat-btn sendBtn border-none cursor-pointer disabled:opacity-50 w-[80px] h-[80px] sm:w-[120px] sm:h-[120px]"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          title="Send"
        >
          <Image
            src="/button.png"
            alt="Send Button"
            width={80}
            height={80}
            quality={80}
            style={{ height: 'auto', width: 'auto' }}
            priority
            className="object-contain"
          />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-md z-50">
          <div className="bg-white rounded-[20px] shadow-lg p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-4">
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
                aria-describedby={feedbackError ? 'feedback-error' : submitError ? 'submit-error' : undefined}
              />
              {feedbackError && <p id="feedback-error" className="text-red-500 text-sm">{feedbackError}</p>}
              {submitError && <p id="submit-error" className="text-red-500 text-sm">{submitError}</p>}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleFeedbackSubmit}
                className={`px-6 py-2 rounded-full text-white transition-colors duration-200 ${
                  feedbackText.trim() ? 'bg-[#3399FF] hover:bg-[#287acc]' : 'bg-gray-400 cursor-not-allowed'
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
          <div className="bg-white rounded-[20px] shadow-lg p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-4">
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
          <div className="bg-white rounded-[20px] shadow-lg p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-4">
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
          <div className="bg-white rounded-[20px] shadow-lg p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-4">
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
    const isFeedbackSubmitted = submittedFeedback[messageProvider][index];

    const getMarkdownComponents = (sender: 'user' | 'bot') => ({
      ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className="pl-6 sm:pl-8 list-decimal max-w-full" {...props} />
      ),
      ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className="pl-6 sm:pl-8 list-disc max-w-full" {...props} />
      ),
      li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
        <div className="pb-1 max-w-full break-words">{props.children}</div>
      ),
      code: (props: {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
        [key: string]: any;
      }) => {
        const { children } = props;
        const content = String(children ?? '').replace(/\n$/, '');

        if (sender === 'user') {
          return (
            <span
              className="break-words font-mono"
              
            >
              {content}
            </span>
          );
        }

        return <CodeComponent {...props} />;
      },
      p: (props: React.HTMLAttributes<HTMLParagraphElement>) => {
        const { children } = props;
        const hasBlockCode = React.Children.toArray(children).some(
          (child) =>
            React.isValidElement(child) &&
            !(child as React.ReactElement<{ inline?: boolean }>).props.inline
        );
        if (hasBlockCode && sender === 'bot') {
          return <div className="max-w-full">{children}</div>;
        }
        return (
          <p
            className="mb-2 break-words overflow-wrap-break-word max-w-full"
           
            {...props}
          >
            {children}
          </p>
        );
      },
      pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
        if (sender === 'user') {
          return (
            <p className="mb-2 break-words overflow-wrap-break-word max-w-full font-mono">
              {props.children}
            </p>
          );
        }
        return (
          <pre
            className="max-w-full break-words"
            {...props}
          >
            {props.children}
          </pre>
        );
      },
      h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3 className="text-lg sm:text-xl font-semibold mb-3 text-black break-words max-w-full" {...props} />
      ),
      h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 className="text-2xl font-bold mb-4 text-black break-words max-w-full" {...props} />
      ),
      h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2 className="text-xl font-bold mb-4 text-black break-words max-w-full" {...props} />
      ),
      table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
        <table className="border-collapse border border-gray-300 my-4 w-full table-auto max-w-full" {...props} />
      ),
      th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
        <th className="border border-gray-300 px-4 py-2 bg-gray-100 break-words" {...props} />
      ),
      td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
        <td className="border border-gray-300 px-4 py-2 break-words" {...props} />
      ),
      strong: (props: React.HTMLAttributes<HTMLElement>) => (
        <strong className="font-bold break-words" {...props} />
      ),
      em: (props: React.HTMLAttributes<HTMLElement>) => <em className="italic break-words" {...props} />,
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          {...props}
          className={`text-blue-600 underline break-words${props.className ? ` ${props.className}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {props.children}
        </a>
      ),
    });

    return (
      <div className="flex flex-col max-w-full">
        {msg.sender === 'user' ? (
          <div className="self-end max-w-[85%] min-w-[10%] flex flex-col">
            <div className="p-3 sm:p-5 md:p-6 rounded-[30px] transition-opacity duration-300 bg-[#ececec] text-black rounded-tr-[30px] rounded-bl-[0] shadow-sm overflow-hidden box-border max-w-full">
              <div className="flex flex-col max-w-full overflow-hidden break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks, remarkGfm]}
                  components={getMarkdownComponents('user')}
                >
                  {preprocessUserText(msg.text).replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="self-start max-w-[85%] min-w-[40%] flex flex-col">
            <div className="p-3 sm:p-5 md:p-6 rounded-[30px] transition-opacity duration-300 bg-[#ececec] text-black rounded-tr-[30px] rounded-bl-[0] shadow-sm overflow-hidden box-border max-w-full">
              <div className="flex flex-col max-w-full overflow-hidden break-words">
                <div className="text-xs text-gray-600 mb-2">
                  {msg.provider === 'openai'
                    ? `OpenAI (${msg.model || 'Unknown'})`
                    : `Ollama (${msg.model || 'Unknown'})`}
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks, remarkGfm]}
                  components={getMarkdownComponents('bot')}
                >
                  {msg.text.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
            </div>
            {(index !== messages.length - 1 || !isLoading) && (
              <div className="flex flex-col items-end gap-2 mt-2 max-w-full">
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
                    className={`transition-all duration-200 transform ${
                      feedbackState[messageProvider][index] === 'thumbs-up'
                        ? 'opacity-100 tint-blue'
                        : 'opacity-60 hover:scale-125 hover:opacity-100'
                    }`}
                    title="Thumbs Up"
                    aria-label="Thumbs Up"
                    aria-describedby={ratingError[index] ? `rating-error-${index}` : undefined}
                    disabled={isFeedbackSubmitted}
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
                    className={`transition-all duration-200 transform ${
                      feedbackState[messageProvider][index] === 'thumbs-down'
                        ? 'opacity-100 tint-blue'
                        : 'opacity-60 hover:scale-125 hover:opacity-100'
                    }`}
                    title="Thumbs Down"
                    aria-label="Thumbs Down"
                    aria-describedby={ratingError[index] ? `rating-error-${index}` : undefined}
                    disabled={isFeedbackSubmitted}
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
                  <p id={`rating-error-${index}`} className="text-red-500 text-xs mt-1" aria-live="polite">
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