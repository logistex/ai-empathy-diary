import styles from "./EmotionBadge.module.css";

// 감정 라벨을 부드러운 칩(뱃지)으로 표시.
// 자주 나오는 감정은 톤에 맞는 색을 주고, 그 외에는 기본 색을 쓴다.
const TONE: Record<string, string> = {
  기쁨: "joy",
  행복: "joy",
  설렘: "joy",
  사랑: "love",
  감사: "love",
  평온: "calm",
  안정: "calm",
  슬픔: "sad",
  우울: "sad",
  그리움: "sad",
  불안: "anxious",
  걱정: "anxious",
  긴장: "anxious",
  분노: "anger",
  짜증: "anger",
  화남: "anger",
  지침: "tired",
  피곤: "tired",
  외로움: "lonely",
};

export default function EmotionBadge({ emotion }: { emotion: string }) {
  const tone = TONE[emotion.trim()] ?? "neutral";
  return (
    <span className={styles.badge} data-tone={tone}>
      <span aria-hidden="true" className={styles.dot} />
      {emotion}
    </span>
  );
}
