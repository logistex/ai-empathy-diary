"use client";

// 화면 ③ — 히스토리 (/history)
// GET /api/diary 로 과거 일기 목록(최신순)을 불러온다.
// 로딩(스켈레톤) / 정상 / 에러(재시도) / 빈 상태를 모두 처리한다.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import AppHeader from "@/components/AppHeader";
import DiaryEntryCard from "@/components/DiaryEntryCard";
import type {
  DiaryEntry,
  DiaryResult,
  DiaryListResponse,
  ApiError,
} from "@/components/types";
import styles from "./page.module.css";

type Phase = "loading" | "success" | "error";

function HistoryView() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // 목록을 불러온다. 상태 갱신은 await 이후에만 일어나므로
  // 마운트 이펙트에서 호출해도 동기 setState 를 유발하지 않는다.
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/diary", { method: "GET" });
      if (!res.ok) {
        let message = "기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
        try {
          const data = (await res.json()) as ApiError;
          if (data?.error?.message) message = data.error.message;
        } catch {
          /* 기본 문구 유지 */
        }
        setErrorMsg(message);
        setPhase("error");
        return;
      }
      const data = (await res.json()) as DiaryListResponse;
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setPhase("success");
    } catch {
      setErrorMsg("네트워크 연결을 확인해 주세요.");
      setPhase("error");
    }
  }, []);

  // "다시 분석" 성공/갱신 시 해당 항목을 그 자리에서 교체한다.
  const handleReanalyzed = useCallback((updated: DiaryResult) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    );
  }, []);

  // 재시도: 로딩 표시 후 다시 조회(이벤트 핸들러이므로 동기 setState 허용).
  const retry = useCallback(() => {
    setPhase("loading");
    setErrorMsg("");
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    // 마운트 시 최초 목록 조회. 상태 변경은 fetch await 이후에만 일어나므로
    // 실제로는 동기 setState 가 아니다(규칙의 정적 분석 한계로 인한 예외 처리).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries();
  }, [fetchEntries]);

  return (
    <div className="page-shell">
      <div className={styles.head}>
        <h1 className={styles.title}>지난 기록</h1>
        <Link href="/write" className="btn btn-ghost">
          오늘 쓰기
        </Link>
      </div>

      {/* 로딩: 스켈레톤 */}
      {phase === "loading" && (
        <div className={styles.list} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}
      {phase === "loading" && (
        <p className="sr-only" role="status" aria-live="polite">
          기록을 불러오는 중이에요…
        </p>
      )}

      {/* 에러 + 재시도 */}
      {phase === "error" && (
        <div className={styles.errorBox} role="alert">
          <p>{errorMsg}</p>
          <button type="button" className="btn btn-primary" onClick={retry}>
            다시 시도
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {phase === "success" && entries.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyEmoji} aria-hidden="true">
            🌤️
          </span>
          <p className={styles.emptyTitle}>아직 기록이 없어요</p>
          <p className={styles.emptyDesc}>첫 한 줄을 남겨보세요.</p>
          <Link href="/write" className="btn btn-primary">
            첫 일기 쓰기
          </Link>
        </div>
      )}

      {/* 정상: 목록 */}
      {phase === "success" && entries.length > 0 && (
        <div className={styles.list}>
          {entries.map((entry) => (
            <DiaryEntryCard
              key={entry.id}
              entry={entry}
              showDate
              onReanalyzed={handleReanalyzed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthGuard>
      <AppHeader />
      <HistoryView />
    </AuthGuard>
  );
}
