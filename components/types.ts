// API 계약(docs/API.md) 기반 프런트엔드 공용 타입.
// 백엔드/AI가 병렬 작업 중이라, UI는 이 계약 타입에만 의존한다.

// 안전 안내 리소스(핫라인 등). safety.flagged=true 일 때 노출.
export interface SafetyResource {
  name: string;
  phone: string;
}

export interface Safety {
  flagged: boolean;
  resources: SafetyResource[];
}

// POST /api/diary 응답(201) — 방금 작성한 일기 + AI 결과 + 안전 안내.
// emotion / empathy_message 는 AI 실패 시 null 이 될 수 있다.
export interface DiaryResult {
  id: number;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
  // 감정 분석에 성공한 무료 모델 ID(폴백 체인 중 실제 응답 모델). AI 실패 시 null.
  model: string | null;
  created_at: string;
  safety: Safety;
}

// GET /api/diary 목록 항목 — safety 는 목록에서 생략될 수 있어 optional.
export interface DiaryEntry {
  id: number;
  content: string;
  emotion: string | null;
  empathy_message: string | null;
  // 분석에 성공한 무료 모델 ID(미분석 시 null).
  model: string | null;
  created_at: string;
  safety?: Safety;
}

export interface DiaryListResponse {
  entries: DiaryEntry[];
}

// 공통 에러 응답 형태.
export interface ApiError {
  error: { code: string; message: string };
}
