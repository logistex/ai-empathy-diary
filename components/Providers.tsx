"use client";

// 전역 인증 컨텍스트 제공.
// next-auth/react 의 SessionProvider 로 앱 전체를 감싸,
// 하위 클라이언트 컴포넌트에서 useSession()/signIn()/signOut() 을 쓸 수 있게 한다.
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
