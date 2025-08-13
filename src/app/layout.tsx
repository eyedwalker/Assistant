import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Assistant Platform - Eyecare Professional Support',
  description: 'AI-powered document processing and conversational assistant for eyecare professionals within the Eyefinity Encompass ecosystem.',
  keywords: ['AI', 'eyecare', 'optometry', 'document processing', 'assistant'],
  authors: [{ name: 'Eyefinity Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
