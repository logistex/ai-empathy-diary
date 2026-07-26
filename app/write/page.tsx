"use client";

// 화면 ② — 일기 작성 + 결과 (/write)
// 한 줄 입력 → POST /api/diary → 공감 메시지 카드 + 감정 표시.
// 로딩 / 성공 / 에러 / (emotion·empathy null) / safety 상태를 모두 처리한다.
import { useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import AppHeader from "@/components/AppHeader";
import DiaryEntryCard from "@/components/DiaryEntryCard";
import { todayLabel } from "@/components/format";
import type { DiaryResult, ApiError } from "@/components/types";
import styles from "./page.module.css";

const MAX = 500;
type Phase = "idle" | "loading" | "success" | "error";

function WriteView() {
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DiaryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const count = Array.from(content).length; // 문자(코드포인트) 단위
  const trimmed = content.trim();
  const over = count > MAX;
  const canSubmit = trimmed.length > 0 && !over && phase !== "loading";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setPhase("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        // 계약된 에러 형태({ error: { code, message } })에서 문구를 뽑는다.
        let message = "일기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
        try {
          const data = (await res.json()) as ApiError;
          if (data?.error?.message) message = data.error.message;
        } catch {
          /* 파싱 실패 시 기본 문구 유지 */
        }
        setErrorMsg(message);
        setPhase("error");
        return;
      }

      const data = (await res.json()) as DiaryResult;
      setResult(data);
      setPhase("success");
      setContent("");
    } catch {
      // 네트워크 등 예외.
      setErrorMsg(
        "네트워크 연결을 확인해 주세요. 인터넷이 불안정하면 저장에 실패할 수 있어요."
      );
      setPhase("error");
    }
  }

  function writeAnother() {
    setResult(null);
    setPhase("idle");
    setErrorMsg("");
  }

  return (
    <div className="page-shell">
      <div className={styles.head}>
        <p className={styles.date}>{todayLabel()}</p>
        <h1 className={styles.greeting}>오늘 하루는 어땠나요?</h1>
      </div>

      {/* 성공 결과 카드 */}
      {phase === "success" && result && (
        <section className={styles.resultBlock} aria-live="polite">
          <DiaryEntryCard entry={result} highlight />
          <div className={styles.resultActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={writeAnother}
            >
              한 줄 더 쓰기
            </button>
            <Link href="/history" className="btn btn-ghost">
              지난 기록 보기
            </Link>
          </div>
        </section>
      )}

      {/* 입력 폼 (결과가 없을 때만 노출) */}
      {phase !== "success" && (
        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="diary" className="sr-only">
            오늘의 일기
          </label>
          <textarea
            id="diary"
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘의 마음을 한 줄로 적어보세요"
            rows={4}
            maxLength={MAX + 40}
            aria-describedby="counter"
            disabled={phase === "loading"}
          />

          <div className={styles.formBar}>
            <span
              id="counter"
              className={styles.counter}
              data-over={over ? "true" : undefined}
            >
              {count} / {MAX}자
            </span>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {phase === "loading" ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  마음을 읽는 중…
                </>
              ) : (
                "기록하기"
              )}
            </button>
          </div>

          {over && (
            <p className={styles.hint} role="alert">
              최대 {MAX}자까지 쓸 수 있어요. 조금만 줄여주세요.
            </p>
          )}

          {/* 로딩 안내(스크린리더 인지) */}
          {phase === "loading" && (
            <p className={styles.loadingMsg} role="status" aria-live="polite">
              AI가 오늘의 마음을 읽고 있어요. 잠시만 기다려 주세요…
            </p>
          )}

          {/* 에러 상태 + 재시도 */}
          {phase === "error" && (
            <div className={styles.errorBox} role="alert" aria-live="assertive">
              <p>{errorMsg}</p>
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={!canSubmit}
              >
                다시 시도
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default function WritePage() {
  return (
    <AuthGuard>
      <AppHeader />
      <WriteView />
    </AuthGuard>
  );
}
