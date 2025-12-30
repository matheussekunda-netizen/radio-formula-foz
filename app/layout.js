import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from './components/PWARegister';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Rádio Fórmula Foz",
  description: "Rádio ambiente da Fórmula Foz",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#FF9E00",
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
      <PWARegister />
        {children}
      </body>
    </html>
  );
}
