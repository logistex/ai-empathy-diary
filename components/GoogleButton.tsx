"use client";

// 구글 브랜드 가이드에 맞춘 "구글로 계속하기" 버튼.
// 로고는 인라인 SVG(외부 요청 없음). loading 시 스피너로 대체.
import styles from "./GoogleButton.module.css";

export default function GoogleButton({
  onClick,
  loading = false,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.gbtn}
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        <svg
          className={styles.icon}
          viewBox="0 0 18 18"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.98 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
      )}
      <span>{loading ? "로그인 중…" : children}</span>
    </button>
  );
}
