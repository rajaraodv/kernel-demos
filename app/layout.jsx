import "./globals.css";

export const metadata = {
  title: "Kernel Demos",
  description: "Live demos built on Kernel browser infrastructure for AI agents.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
