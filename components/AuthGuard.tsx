"use client";

// UI 레벨 인증 가드.
// 미들웨어 강제 대신, 미로그인 사용자에게는 부드러운 로그인 유도를 보여준다.
// - loading: 세션 확인 중 스피너
// - unauthenticated: 로그인 안내 + 구글 로그인 버튼
// - authenticated: 실제 화면(children)
import { useSession, signIn } from "next-auth/react";
import GoogleButton from "./GoogleButton";
import styles from "./AuthGuard.module.css";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className={styles.center} role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p className={styles.muted}>불러오는 중이에요…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className={styles.center}>
        <div className={styles.gate}>
          <h1 className={styles.title}>로그인이 필요해요</h1>
          <p className={styles.muted}>
            내 일기를 안전하게 보관하려면 구글 계정으로 로그인해 주세요.
          </p>
          <GoogleButton onClick={() => signIn("google", { callbackUrl: "/write" })}>
            구글로 계속하기
          </GoogleButton>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
