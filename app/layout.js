import './globals.css';

export const metadata = {
  title: 'FlowBoard — AI-Powered Collaborative Project Management',
  description: 'Full-stack Trello/Asana style project management tool powered by GitHub AI skill matching, real-time WebSockets, automated task breakdown, and deadline risk detection.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-[#FAFAFA] text-[#18181B] font-sans">{children}</body>
    </html>
  );
}
