import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { describe, vi, it, beforeEach, expect } from 'vitest';

// Very simple test to check if the HomePage component renders without crashing and if the logo is displayed correctly
// mock the fetch function
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ thread_id: 'mock-thread', chroma_conversation_id: 'mock-chroma' }),
  } as Response)
);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  process.env.NEXT_PUBLIC_OLLAMA_HOST = 'http://localhost:11434';
  process.env.NEXT_PUBLIC_CHATBOT_OLLAMA_MODEL_NAME = 'llama3.2';
});

describe('HomePage', () => {
    it('renders without crashing', async () => {
        // for debugging purposes
        //console.log('Rendering HomePage component...');
        render(<HomePage />);
        //console.log('Rendered component:', view.container.innerHTML);
        expect(await screen.findByText('No messages yet.')).toBeInTheDocument();
    });

    it('displays the logo', async () => {
        //console.log('Testing logo display...');
        render(<HomePage />);
        const logo = await screen.findByAltText('NextJS-AI-Chatbot logo');
        //console.log('Found logo element:', logo);
        expect(logo).toBeInTheDocument();
    });
});
