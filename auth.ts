// auth.ts — Auth.js(NextAuth v5) 설정
//
// 세션 전략은 JWT. 구글 제공자를 사용하며, 자격증명은 아래 환경변수에서 읽는다.
//   - AUTH_GOOGLE_ID     : 구글 OAuth 클라이언트 ID
//   - AUTH_GOOGLE_SECRET : 구글 OAuth 클라이언트 시크릿
//   - AUTH_SECRET        : 세션(JWT) 암호화 키
//
// 로그인 시 google_sub 기준으로 users 를 upsert 하고, 내부 user_id 를 JWT/세션에 실어
// API 라우트에서 소유권 검증(본인 데이터만 접근)에 사용한다.

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser } from "@/lib/db";

// 세션에 내부 user_id 를 싣기 위한 타입 확장.
declare module "next-auth" {
  interface Session {
    user: { id: number } & DefaultSession["user"];
  }
}

// JWT 페이로드에 싣는 내부 user_id (토큰 캐스팅용 형태).
type TokenWithUserId = { userId?: number };

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // 최초 로그인 시(account/profile 이 있을 때)에만 users 를 upsert 하고
    // 반환된 내부 user_id 를 JWT 에 저장한다. 이후 요청에서는 토큰의 값을 재사용한다.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const g = profile as {
          sub?: string;
          email?: string | null;
          name?: string | null;
          picture?: string | null;
        };
        if (g.sub) {
          (token as TokenWithUserId).userId = await upsertUser({
            google_sub: g.sub,
            email: g.email ?? null,
            name: g.name ?? null,
            image: g.picture ?? null,
          });
        }
      }
      return token;
    },
    // 라우트에서 session.user.id 로 내부 user_id 에 접근할 수 있게 세션에 노출한다.
    async session({ session, token }) {
      const userId = (token as TokenWithUserId).userId;
      if (userId != null) {
        (session.user as { id: number }).id = userId;
      }
      return session;
    },
  },
});
