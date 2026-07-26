import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AI 공감 다이어리",
  description: "한 줄 일기에 AI가 공감해 주는 따뜻한 다이어리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {/* 전역 인증 컨텍스트(SessionProvider)로 앱 전체를 감싼다 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
