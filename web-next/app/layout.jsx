import './globals.css';

export const metadata = {
  title: 'Crevo',
  description: 'Crevo restaurant experience'
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
