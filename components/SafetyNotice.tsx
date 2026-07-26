import type { SafetyResource } from "./types";
import styles from "./SafetyNotice.module.css";

// 위기 신호가 감지되었을 때(safety.flagged=true) 공감 메시지와 함께
// 부드럽지만 눈에 띄게 안전 안내(핫라인 등)를 노출한다.
export default function SafetyNotice({
  resources,
}: {
  resources: SafetyResource[];
}) {
  if (resources.length === 0) return null;

  return (
    <aside className={styles.notice} role="note" aria-label="안전 안내">
      <p className={styles.lead}>
        많이 힘든 마음이 느껴져요. 혼자 견디지 않으셔도 괜찮아요. 언제든 아래로
        도움을 받을 수 있어요.
      </p>
      <ul className={styles.list}>
        {resources.map((r) => (
          <li key={`${r.name}-${r.phone}`} className={styles.item}>
            <span className={styles.name}>{r.name}</span>
            <a className={styles.phone} href={`tel:${r.phone}`}>
              {r.phone}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
