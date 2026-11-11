import type { Metadata } from "next";
import { Nunito } from "next/font/google"; // Đổi sang font Nunito
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrewLite",
  description: "Ứng dụng đặt cà phê không dùng tiền mặt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${nunito.className} bg-[#F8F5F2]`}>{children}</body>
    </html>
  );
}