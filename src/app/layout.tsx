import './globals.css';

export const metadata = {
  title: 'NextJS-Chatbot',
  description: 'NextJS-Chatbot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
