# AI 공감 다이어리 — API 계약 (확정본, 1단계)

- **문서 상태**: 확정 v1.0 (마일스톤 M1)
- **관련 문서**: [`PRD.md`](./PRD.md), [`PLAN.md`](./PLAN.md)
- **대상 독자**: 2A(백엔드) · 2B(AI) · 2C(프런트) 병렬 트랙. **이 문서만 보고 각 트랙이 독립 작업**할 수 있도록 작성.

> 이 계약은 병렬 작업의 기준선이다. 변경이 필요하면 먼저 이 문서를 고치고 세 트랙에 공유한다.

---

## 0. 공통 규약

- **베이스 경로**: 모든 앱 API는 `/api/*`.
- **콘텐츠 타입**: 요청·응답 모두 `application/json; charset=utf-8`.
- **인증**: `/api/diary`의 모든 메서드는 **로그인 필요**. 세션은 Auth.js(NextAuth v5, **JWT 전략**) 쿠키로 전달된다. 서버는 세션의 사용자에 매핑되는 내부 `user_id` 기준으로 **소유권을 검증**한다(타인 데이터 접근 차단).
- **시간 형식**: 모든 타임스탬프는 ISO 8601 문자열(UTC, 예: `2026-07-26T12:34:56.000Z`).
- **문자 인코딩/길이**: `content` 길이는 **글자 수(문자 단위, 최대 500자)** 로 센다(바이트 아님).

### 0.1 에러 응답 규약 (공통)

에러는 항상 아래 형태의 JSON과 적절한 HTTP 상태코드로 반환한다.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "일기 내용은 1자 이상 500자 이하여야 합니다." } }
```

| HTTP | `code` | 의미 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 요청 형식·값 오류(빈 내용, 500자 초과, JSON 파싱 실패 등) |
| 401 | `UNAUTHORIZED` | 미로그인/세션 없음 |
| 404 | `NOT_FOUND` | 존재하지 않는 리소스 |
| 429 | `RATE_LIMITED` | (예약) 사용자당 요청 제한 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

> `message`는 사용자에게 그대로 노출 가능한 한국어 문구를 지향한다.

### 0.2 안전(safety) 필드 정책

자해·위기 관련 발화가 감지되면, 공감 메시지와 **함께 안전 안내(핫라인 등)** 를 노출한다. 계약에는 자리를 마련하고, **실제 판정 로직은 2B(AI) 단계에서 구현**한다.

```jsonc
"safety": {
  "flagged": false,            // 위기 신호 감지 여부. 기본 false.
  "resources": [               // flagged=true 일 때 노출할 안내 목록. 기본 [].
    { "name": "자살예방 상담전화", "phone": "109" }
  ]
}
```

- `safety`는 **응답 시점에 파생**되는 값으로, DB 컬럼으로 저장하지 않는다(데이터 모델 확정본 유지).
- `flagged=false`이면 `resources`는 빈 배열.
- 프런트(2C)는 `flagged=true`일 때 공감 메시지 카드와 함께 `resources`를 안내 UI로 노출한다.

---

## 1. `POST /api/diary` — 일기 작성 (로그인 필요)

한 줄 일기를 저장하고, 감정 분석·공감 메시지·안전 안내를 돌려준다.

### 요청

```json
{ "content": "오늘은 하루 종일 마음이 무거웠다." }
```

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `content` | string | ✅ | 트림 후 1자 이상, **최대 500자** |

### 응답 `201 Created`

```json
{
  "id": 42,
  "content": "오늘은 하루 종일 마음이 무거웠다.",
  "emotion": "불안",
  "empathy_message": "오늘 많이 힘드셨겠어요. 그 마음, 충분히 그럴 수 있어요.",
  "model": "google/gemma-4-31b-it:free",
  "created_at": "2026-07-26T12:34:56.000Z",
  "safety": { "flagged": false, "resources": [] }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 생성된 일기 ID |
| `content` | string | 저장된 원문 |
| `emotion` | string \| **null** | 감정 라벨. **AI 실패 시 `null`** |
| `empathy_message` | string \| **null** | 공감 메시지. **AI 실패 시 `null`** |
| `model` | string \| **null** | 감정 분석에 성공한 무료 모델 ID(폴백 체인 중 실제 응답 모델). **AI 실패 시 `null`** |
| `created_at` | string | 생성 시각(ISO 8601) |
| `safety` | object | 안전 안내(0.2 참조) |

### 핵심 동작 규칙 (확정)

- **일기 원문은 AI 결과와 무관하게 항상 저장된다.** AI 감정분석/공감 생성이 실패해도 요청은 **`201`로 성공** 처리하며, `emotion`·`empathy_message`를 `null`로 반환한다.
- `emotion`/`empathy_message`의 `null`은 **"아직 분석되지 않음(재시도 가능)"** 을 의미한다. 이런 항목은 **재분석 엔드포인트(3장)** 로 다시 분석할 수 있다.
- 위기 발화 감지 시 `safety.flagged=true`와 `resources`를 함께 반환한다.

### 에러

| 상황 | HTTP | `code` |
|---|---|---|
| 미로그인 | 401 | `UNAUTHORIZED` |
| 빈 내용 / 500자 초과 / 잘못된 JSON | 400 | `VALIDATION_ERROR` |
| DB 저장 실패 등 내부 오류 | 500 | `INTERNAL_ERROR` |

> 참고: **OpenRouter(AI) 호출 실패는 500이 아니다.** 위 "핵심 동작 규칙"대로 `201` + `null`로 처리한다.

---

## 2. `GET /api/diary` — 일기 목록 조회 (로그인 필요)

현재 로그인 사용자 **본인**의 일기만 최신순으로 반환한다.

### 요청

- 바디 없음. (페이지네이션은 이번 범위 밖 — 전체 최신순 반환.)

### 응답 `200 OK`

```json
{
  "entries": [
    {
      "id": 42,
      "content": "오늘은 하루 종일 마음이 무거웠다.",
      "emotion": "불안",
      "empathy_message": "오늘 많이 힘드셨겠어요. 그 마음, 충분히 그럴 수 있어요.",
      "model": "google/gemma-4-31b-it:free",
      "created_at": "2026-07-26T12:34:56.000Z"
    },
    {
      "id": 41,
      "content": "친구랑 오랜만에 웃었다.",
      "emotion": null,
      "empathy_message": null,
      "model": null,
      "created_at": "2026-07-25T09:00:00.000Z"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `entries` | array | 일기 목록. 없으면 빈 배열 `[]` (프런트는 empty state 표시) |
| `entries[].id` | number | 일기 ID |
| `entries[].content` | string | 원문 |
| `entries[].emotion` | string \| null | 감정 라벨(미분석 시 null) |
| `entries[].empathy_message` | string \| null | 공감 메시지(미분석 시 null) |
| `entries[].model` | string \| null | 분석에 성공한 무료 모델 ID(미분석 시 null) |
| `entries[].created_at` | string | 생성 시각(ISO 8601) |
| `entries[].safety` | object \| (생략) | 선택. 목록에서는 생략 가능. 위기 안내는 주로 작성(POST) 시점에 노출한다. |

> `emotion`/`model`이 `null`인 항목은 재분석 엔드포인트(3장)로 다시 분석할 수 있다.

- **정렬**: `created_at` **내림차순(최신 우선)**.
- **소유권**: 서버가 세션의 `user_id`로 필터링. 타 사용자 데이터는 절대 포함되지 않는다.

### 에러

| 상황 | HTTP | `code` |
|---|---|---|
| 미로그인 | 401 | `UNAUTHORIZED` |
| 내부 오류 | 500 | `INTERNAL_ERROR` |

---

## 3. `POST /api/diary/[id]/reanalyze` — 재분석 (로그인 필요)

감정 분석이 실패해 `emotion`/`model`이 `null`인 일기를, 저장된 원문으로 **다시 분석**해 `emotion`·`empathy_message`·`model`을 갱신한다. (프런트의 "다시 분석" 버튼용.)

### 요청

- 경로 파라미터 `id`: 대상 일기 ID. 바디 없음.

### 응답 `200 OK`

갱신된 일기 항목을 `POST /api/diary`와 동일한 형태로 반환한다(`safety` 포함).

```json
{
  "id": 41,
  "content": "친구랑 오랜만에 웃었다.",
  "emotion": "기쁨",
  "empathy_message": "좋은 하루였네요. 그 웃음이 오래 남길 바라요.",
  "model": "google/gemma-4-26b-a4b-it:free",
  "created_at": "2026-07-25T09:00:00.000Z",
  "safety": { "flagged": false, "resources": [] }
}
```

- 재분석도 실패하면(모든 무료 모델 실패) `emotion`/`model`은 여전히 `null`로 갱신되며 응답은 `200`이다. 사용자는 다시 시도할 수 있다.
- **소유권**: 본인 일기가 아니면 갱신하지 않는다.

### 에러

| 상황 | HTTP | `code` |
|---|---|---|
| 미로그인 | 401 | `UNAUTHORIZED` |
| 잘못된 `id` | 400 | `VALIDATION_ERROR` |
| 존재하지 않거나 본인 일기가 아님 | 404 | `NOT_FOUND` |
| DB 갱신 실패 등 내부 오류 | 500 | `INTERNAL_ERROR` |

---

## 4. `/api/auth/*` — 인증 (Auth.js)

Auth.js(NextAuth v5)가 제공하는 표준 라우트. 구글 OAuth · **JWT 세션**.

- `GET /api/auth/signin` — 로그인 시작(구글 동의 화면으로 이동)
- `GET /api/auth/callback/google` — 구글 OAuth 콜백
- `POST /api/auth/signout` — 로그아웃
- `GET /api/auth/session` — 현재 세션 정보(JSON)
- `GET /api/auth/csrf` / `GET /api/auth/providers` — CSRF 토큰 / 제공자 목록

프런트(2C)는 `next-auth/react`의 `signIn("google")` / `signOut()` 헬퍼를 쓰는 것을 권장한다(직접 URL 호출 대신).

### 필요 환경변수 (서버)

| 변수 | 용도 |
|---|---|
| `AUTH_GOOGLE_ID` | 구글 OAuth 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | 구글 OAuth 클라이언트 시크릿 |
| `AUTH_SECRET` | 세션(JWT) 서명·암호화 키 |

승인된 리디렉션 URI(구글 콘솔): `http://localhost:3000/api/auth/callback/google`, `https://<앱>.vercel.app/api/auth/callback/google`.

---

## 5. 범위 밖 (이번 계약에 없음)

- **일기 삭제** `DELETE /api/diary/:id` — P1. 아직 **포함하지 않는다**(작성/조회/재분석만).
- 일기 수정, 페이지네이션, 통계/차트 API — 향후.
