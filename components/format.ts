// 날짜 포맷 유틸.

// ISO 문자열 → "2026년 7월 26일 (일)" 형태의 한국어 날짜.
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

// 오늘 날짜(작성 화면 헤더용).
export function todayLabel(): string {
  return formatDate(new Date().toISOString());
}

// 분석 모델 ID를 사용자 친화적으로 짧게 축약.
// 예) "google/gemma-4-31b-it:free" → "gemma-4-31b"
//     "google/gemma-4-26b-a4b-it:free" → "gemma-4-26b-a4b"
export function shortModelName(model: string): string {
  const afterSlash = model.split("/").pop() ?? model; // 벤더 접두어 제거
  const noTag = afterSlash.split(":")[0]; // ":free" 등 태그 제거
  return noTag.replace(/-(it|instruct)$/i, ""); // 지시튜닝 접미어 제거
}
