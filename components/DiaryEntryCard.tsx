import type { DiaryEntry } from "./types";
import EmotionBadge from "./EmotionBadge";
import SafetyNotice from "./SafetyNotice";
import { formatDate } from "./format";
import styles from "./DiaryEntryCard.module.css";

// 일기 한 건을 보여주는 카드.
// 작성 결과 화면과 히스토리 목록에서 공용으로 쓴다.
// - showDate: 날짜 헤더 노출 여부(히스토리에서 사용)
// - highlight: 방금 작성한 결과를 강조(작성 화면에서 사용)
export default function DiaryEntryCard({
  entry,
  showDate = false,
  highlight = false,
}: {
  entry: DiaryEntry;
  showDate?: boolean;
  highlight?: boolean;
}) {
  const analyzed = entry.emotion !== null || entry.empathy_message !== null;

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
        {entry.emotion && <EmotionBadge emotion={entry.emotion} />}
      </header>

      <p className={styles.content}>{entry.content}</p>

      {entry.empathy_message ? (
        <blockquote className={styles.empathy}>
          {entry.empathy_message}
        </blockquote>
      ) : (
        // AI가 아직 분석하지 못한 경우(감정/공감 모두 null) 부드럽게 안내.
        !analyzed && (
          <p className={styles.pending}>
            감정 분석에 실패했어요. 일기는 안전하게 저장되었으니, 잠시 후 다시
            시도해 주세요.
          </p>
        )
      )}

      {entry.safety?.flagged && (
        <SafetyNotice resources={entry.safety.resources} />
      )}
    </article>
  );
}
