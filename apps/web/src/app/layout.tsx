import type { Metadata } from "next";
import { Nunito } from "next/font/google"; // Đổi sang font Nunito
import "./globals.css";
import ServiceWorkerRegistration from "./service-worker-registration";

const nunito = Nunito({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrewLite",
  description: "Ứng dụng đặt cà phê không dùng tiền mặt",
  applicationName: "BrewLite",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${nunito.className} bg-[#F8F5F2]`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}