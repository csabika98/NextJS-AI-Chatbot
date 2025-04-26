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
});

describe('HomePage', () => {
    it('renders without crashing', () => {
        // for debugging purposes
        //console.log('Rendering HomePage component...');
        const view = render(<HomePage />);
        //console.log('Rendered component:', view.container.innerHTML);
        expect(screen.getByText('Chatbot')).toBeInTheDocument();
    });

    it('displays the logo', () => {
        //console.log('Testing logo display...');
        render(<HomePage />);
        const logo = screen.getByAltText('logo');
        //console.log('Found logo element:', logo);
        expect(logo).toBeInTheDocument();
    });
});
