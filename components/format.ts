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
