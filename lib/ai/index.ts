// 감정 분석 · 공감 메시지 · 안전(위기) 안내 모듈
//
// 백엔드(app/api/diary)에서 호출하는 유일한 공개 함수는 analyzeEntry 이다.
// - 한 줄 일기를 받아 무료 모델 폴백 체인으로 감정 라벨과 공감 메시지를 생성한다.
//   1순위 모델이 429/5xx/네트워크오류/JSON파싱실패면 다음 무료 모델로 자동 전환된다
//   (폴백 체인은 lib/ai/openrouter.ts의 FREE_MODELS 참조, 전부 무료 :free 모델).
// - 모든 무료 모델이 실패할 때만 예외를 던지지 않고 emotion·empathy_message 를
//   null 로 반환한다. (계약 docs/API.md 의 "원문은 항상 저장, AI 실패 시 null" 규칙.)
// - 위기(자해·자살) 신호는 키워드로 감지해 safety.flagged·resources 를 채운다.
//   위기 감지는 AI 성공/실패와 무관하게 항상 원문 기준으로 동작한다.

import { chatCompletionWithFallback, type ChatMessage } from "./openrouter";

export interface SafetyResource {
  name: string;
  phone: string;
}

export interface Safety {
  flagged: boolean;
  resources: SafetyResource[];
}

export interface AnalyzeResult {
  emotion: string | null;
  empathy_message: string | null;
  /** 감정 분석에 성공한 무료 모델 ID. 실패 시 null. */
  model: string | null;
  safety: Safety;
}

/** 위기 감지 시 안내할 안전 자원(대한민국 기준). */
const SAFETY_RESOURCES: SafetyResource[] = [
  { name: "자살예방 상담전화", phone: "109" },
  { name: "정신건강 상담전화", phone: "1577-0199" },
  { name: "청소년 상담전화", phone: "1388" },
];

/**
 * 자해·자살·위기 관련 발화를 키워드로 감지한다.
 * 모델 응답에 의존하지 않으므로 AI 호출이 실패해도 동작한다.
 * (오탐을 줄이되, 놓치는 것보다 과하게 잡는 편이 안전하다.)
 */
// "죽겠어"(배고파/예뻐 죽겠어 등 관용구)는 일부러 잡지 않는다. 위기 표현은
// "죽고/죽어 버리고 싶" 처럼 의도가 드러나는 형태만 매칭해 오탐을 피한다.
const CRISIS_PATTERNS: RegExp[] = [
  /죽고\s*싶/,
  /죽어\s*버리/, // "죽어 버리고 싶어"
  /자살/,
  /목숨.*(끊|끝내)|끊.*목숨/, // "목숨을 끊다 / 목숨 끝내다"
  /사라지고\s*싶/,
  /살기\s*싫|살고\s*싶지\s*않/,
  /다\s*끝내고\s*싶|끝내버리고\s*싶/,
  /자해/,
  /더\s*이상.*못\s*살|못\s*버티겠|못\s*살겠|못\s*견디겠/,
];

/**
 * 원문에서 위기 신호를 감지해 안전 안내(safety)를 계산한다.
 * AI 호출 없이 원문만으로 동작하므로, 작성(POST)뿐 아니라
 * 히스토리 조회(GET)에서도 값싸게 재계산해 위기 안내를 노출할 수 있다.
 */
export function computeSafety(content: string): Safety {
  const flagged = CRISIS_PATTERNS.some((re) => re.test(content));
  return { flagged, resources: flagged ? SAFETY_RESOURCES : [] };
}

/** 모델이 코드펜스(```json … ```)로 감싸 응답하는 경우를 대비해 벗겨낸다. */
function stripCodeFence(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

/** 응답 문자열에서 첫 번째 JSON 객체를 파싱한다. 실패 시 null. */
function parseModelJson(
  raw: string,
): { emotion?: unknown; message?: unknown } | null {
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    // 앞뒤 잡텍스트가 섞인 경우 첫 { … } 구간만 잘라 재시도.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function toLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const SYSTEM_PROMPT = [
  "너는 한국어로 대화하는 따뜻한 감정 코치다.",
  "사용자의 '한 줄 일기'를 읽고 두 가지를 한국어로 만든다.",
  "1) emotion: 일기에 담긴 핵심 감정을 짧은 한 단어 라벨로. (예: 불안, 기쁨, 슬픔, 분노, 평온, 외로움)",
  "2) message: 사용자의 마음을 있는 그대로 인정하고 위로하는 2~3문장의 따뜻한 공감 메시지. 판단하거나 훈계하지 말 것.",
  "설명이나 인사말 없이 아래 형식의 JSON 객체 하나만 출력한다.",
  '{"emotion":"...","message":"..."}',
].join("\n");

/** 위기 상황일 때 공감 메시지에 덧붙이는 안전 안내 문구. */
const SAFETY_APPENDIX =
  " 지금 많이 힘드시다면 혼자 견디지 않으셨으면 해요. 자살예방 상담전화 109(24시간)에 언제든 도움을 청할 수 있어요.";

/**
 * 한 줄 일기를 분석해 감정 라벨·공감 메시지·안전 안내를 돌려준다.
 * 어떤 경우에도 예외를 던지지 않는다(백엔드가 원문 저장 후 재시도 가능).
 */
export async function analyzeEntry(content: string): Promise<AnalyzeResult> {
  // 위기 감지는 AI 성공 여부와 무관하게 원문 기준으로 먼저 계산한다.
  const safety = computeSafety(content);
  const flagged = safety.flagged;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];

  try {
    // 무료 모델 폴백 체인으로 호출한다. 검증 함수로 "JSON 파싱 가능 + 감정 라벨 존재"를
    // 확인해, 파싱 실패한 응답이면 openrouter가 자동으로 다음 무료 모델로 넘어간다.
    const { content: raw, model } = await chatCompletionWithFallback(
      messages,
      {},
      (text) => {
        const p = parseModelJson(text);
        return !!p && toLabel(p.emotion) !== null;
      },
    );
    const parsed = parseModelJson(raw);
    if (!parsed) {
      // (검증을 통과했다면 여기 도달하지 않지만) 안전하게 미분석(null) 반환.
      return { emotion: null, empathy_message: null, model: null, safety };
    }

    const emotion = toLabel(parsed.emotion);
    let empathy = toLabel(parsed.message);

    // 위기 감지 시 공감은 따뜻하게 유지하되 안전 안내를 덧붙인다.
    if (flagged && empathy) {
      empathy += SAFETY_APPENDIX;
    }

    // 감정 라벨이 나온 경우에만 분석 성공으로 보고 모델명을 기록한다.
    return { emotion, empathy_message: empathy, model: emotion ? model : null, safety };
  } catch {
    // 네트워크/타임아웃/HTTP 오류 → 미분석(null). 안전 안내는 유지.
    return { emotion: null, empathy_message: null, model: null, safety };
  }
}
