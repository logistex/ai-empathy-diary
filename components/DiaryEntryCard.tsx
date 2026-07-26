"use client";

import { useState } from "react";
import type { DiaryEntry, DiaryResult, ApiError } from "./types";
import EmotionBadge from "./EmotionBadge";
import SafetyNotice from "./SafetyNotice";
import { formatDate, shortModelName } from "./format";
import styles from "./DiaryEntryCard.module.css";

// 일기 한 건을 보여주는 카드.
// 작성 결과 화면과 히스토리 목록에서 공용으로 쓴다.
// - showDate: 날짜 헤더 노출 여부(히스토리에서 사용)
// - highlight: 방금 작성한 결과를 강조(작성 화면에서 사용)
// - onReanalyzed: "다시 분석" 성공 시 갱신 항목을 부모 상태로 올려 그 자리에서 카드가 갱신되게 한다.
export default function DiaryEntryCard({
  entry,
  showDate = false,
  highlight = false,
  onReanalyzed,
}: {
  entry: DiaryEntry;
  showDate?: boolean;
  highlight?: boolean;
  onReanalyzed?: (updated: DiaryResult) => void;
}) {
  // emotion 이 null 이면 아직 분석되지 않은(재시도 가능한) 항목.
  const needsReanalyze = entry.emotion === null;

  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState("");
  // 재분석을 시도했지만 여전히 null 로 돌아온 경우(안내 문구 전환용).
  const [attempted, setAttempted] = useState(false);

  async function reanalyze() {
    if (reanalyzing) return;
    setReanalyzing(true);
    setReanalyzeError("");

    try {
      const res = await fetch(`/api/diary/${entry.id}/reanalyze`, {
        method: "POST",
      });

      if (!res.ok) {
        let message = "다시 분석하지 못했어요. 잠시 후 다시 시도해 주세요.";
        try {
          const data = (await res.json()) as ApiError;
          if (data?.error?.message) message = data.error.message;
        } catch {
          /* 파싱 실패 시 기본 문구 유지 */
        }
        setReanalyzeError(message);
        return;
      }

      const updated = (await res.json()) as DiaryResult;
      setAttempted(true);
      // 성공/여전히실패 모두 갱신 항목으로 부모 상태를 교체한다.
      // 분석이 채워졌으면 이 카드의 재분석 블록은 사라지고, 여전히 null 이면 안내가 바뀐다.
      onReanalyzed?.(updated);
    } catch {
      setReanalyzeError(
        "네트워크 연결을 확인해 주세요. 잠시 후 다시 시도해 주세요."
      );
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <article
      className={styles.card}
      data-highlight={highlight ? "true" : undefined}
    >
      <header className={styles.head}>
        {showDate && (
          <time className={styles.date} dateTime={entry.created_at}>
            {formatDate(entry.created_at)}
          </time>
        )}
        {(entry.emotion || entry.model) && (
          <div className={styles.meta}>
            {entry.emotion && <EmotionBadge emotion={entry.emotion} />}
            {entry.model && (
              <span className={styles.model} title={entry.model}>
                <span aria-hidden="true">🤖</span>
                {shortModelName(entry.model)} 분석
              </span>
            )}
          </div>
        )}
      </header>

      <p className={styles.content}>{entry.content}</p>

      {entry.empathy_message && (
        <blockquote className={styles.empathy}>
          {entry.empathy_message}
        </blockquote>
      )}

      {/* 아직 분석되지 않은(emotion=null) 항목: 안내 + "다시 분석" */}
      {needsReanalyze && onReanalyzed && (
        <div className={styles.reanalyze}>
          <p className={styles.pending}>
            {attempted
              ? "분석이 아직 안 됐어요. 잠시 후 다시 시도해 주세요."
              : "감정 분석에 실패했어요. 일기는 안전하게 저장되었으니, 다시 분석해 볼 수 있어요."}
          </p>

          <div className={styles.reanalyzeActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={reanalyze}
              disabled={reanalyzing}
            >
              {reanalyzing ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  다시 분석 중…
                </>
              ) : (
                "다시 분석"
              )}
            </button>
          </div>

          {/* 로딩 상태를 스크린리더에 알림(무료 모델 폴백이라 시간이 걸릴 수 있음) */}
          <p className="sr-only" role="status" aria-live="polite">
            {reanalyzing
              ? "다시 분석 중이에요. 잠시만 기다려 주세요."
              : ""}
          </p>

          {reanalyzeError && (
            <p className={styles.reError} role="alert">
              {reanalyzeError}
            </p>
          )}
        </div>
      )}

      {entry.safety?.flagged && (
        <SafetyNotice resources={entry.safety.resources} />
      )}
    </article>
  );
}
