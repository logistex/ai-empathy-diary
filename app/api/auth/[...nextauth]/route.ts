// Auth.js 라우트 핸들러 — /api/auth/* (로그인, 콜백, 로그아웃 등)
// 실제 설정은 루트 auth.ts 에 있다.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
