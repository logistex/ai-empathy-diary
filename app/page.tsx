"use client";

// 화면 ① — 로그인 (/)
// 서비스 소개 + 구글 로그인. 이미 로그인한 사용자는 작성 화면으로 안내한다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import GoogleButton from "@/components/GoogleButton";
import styles from "./page.module.css";

const VALUES = [
  { emoji: "💬", title: "감정 분석", desc: "한 줄에 담긴 마음을 읽어드려요" },
  { emoji: "🤍", title: "공감 메시지", desc: "판단 없이 따뜻하게 응답해요" },
  { emoji: "📖", title: "나만의 기록", desc: "오직 나만 보는 안전한 일기" },
];

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  // 이미 로그인 상태면 작성 화면으로 자동 이동.
  useEffect(() => {
    if (status === "authenticated") router.replace("/write");
  }, [status, router]);

  const authed = status === "authenticated";

  return (
    <main className={styles.wrap}>
      <section className={styles.hero}>
        <span className={styles.logo} aria-hidden="true">
          🌱
        </span>
        <h1 className={styles.title}>AI 공감 다이어리</h1>
        <p className={styles.tagline}>
          한 줄 일기에 AI가 공감해 주는 따뜻한 다이어리
        </p>

        <ul className={styles.values}>
          {VALUES.map((v) => (
            <li key={v.title} className={styles.value}>
              <span className={styles.valueEmoji} aria-hidden="true">
                {v.emoji}
              </span>
              <span className={styles.valueTitle}>{v.title}</span>
              <span className={styles.valueDesc}>{v.desc}</span>
            </li>
          ))}
        </ul>

        <div className={styles.cta}>
          {authed ? (
            // 리디렉션이 도는 사이 잠깐 노출되는 대체 안내.
            <Link href="/write" className="btn btn-primary">
              오늘의 일기 쓰러 가기
            </Link>
          ) : (
            <GoogleButton
              loading={signingIn}
              onClick={() => {
                setSigningIn(true);
                signIn("google", { callbackUrl: "/write" });
              }}
            >
              구글로 계속하기
            </GoogleButton>
          )}
          <p className={styles.fineprint}>
            로그인하면 오늘의 마음을 한 줄로 남길 수 있어요.
          </p>
        </div>
      </section>
    </main>
  );
}
