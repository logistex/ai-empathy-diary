"use client";

// 로그인 후 화면(작성/히스토리) 상단 헤더.
// 작성 ↔ 히스토리 이동, 프로필(이미지/이름), 로그아웃을 제공한다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import styles from "./AppHeader.module.css";

export default function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className={styles.header}>
      <Link href="/write" className={styles.brand}>
        <span aria-hidden="true">🌱 </span>
        <span>공감 다이어리</span>
      </Link>

      <nav className={styles.nav} aria-label="주요 화면 이동">
        <Link
          href="/write"
          className={styles.navLink}
          aria-current={pathname === "/write" ? "page" : undefined}
        >
          오늘 쓰기
        </Link>
        <Link
          href="/history"
          className={styles.navLink}
          aria-current={pathname === "/history" ? "page" : undefined}
        >
          지난 기록
        </Link>
      </nav>

      <div className={styles.account}>
        {user && (
          <span className={styles.profile}>
            {user.image ? (
              // 외부 프로필 이미지 — 최적화 없이 단순 표시(next/image 도메인 설정 회피)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.avatar}
                src={user.image}
                alt=""
                width={28}
                height={28}
              />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {(user.name ?? "나").charAt(0)}
              </span>
            )}
            <span className={styles.name}>{user.name ?? "내 계정"}</span>
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
