// auth.ts — Auth.js(NextAuth v5) 설정 뼈대
//
// 이 단계는 "골격"만 만든다. 실제 로그인 테스트/DB 연동(users 테이블 upsert)은 2A 단계 몫.
// 세션 전략은 JWT. 구글 제공자를 사용하며, 자격증명은 아래 환경변수에서 읽는다.
//   - AUTH_GOOGLE_ID     : 구글 OAuth 클라이언트 ID
//   - AUTH_GOOGLE_SECRET : 구글 OAuth 클라이언트 시크릿
//   - AUTH_SECRET        : 세션(JWT) 암호화 키
// (NextAuth v5는 위 이름의 환경변수를 자동 인식하지만, 명시성을 위해 직접 전달한다.)

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  // TODO(2A): signIn 콜백에서 users 테이블 upsert(google_sub 기준),
  //           jwt/session 콜백에서 내부 user_id를 세션에 실어 API 소유권 검증에 사용.
});
