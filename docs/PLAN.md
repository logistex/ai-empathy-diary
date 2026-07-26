# AI 공감 다이어리 — 작업 계획

## 제품 개요

한 줄 일기를 쓰면 AI가 감정을 분석하고 공감·위로 메시지를 돌려주는 일기 앱.

- **스택**: Next.js (App Router) + Vercel / PostgreSQL (AWS) / OpenRouter `google/gemma-4-31b-it:free` / Auth.js 구글 로그인
- **저장소**: `ai-empathy-diary` (공개)

## 아키텍처

```
[브라우저 UI] ──① 일기 작성──▶ [Next.js API 라우트(서버)]
                                    │ ② OpenRouter 호출 (gemma-4-31b:free)
                                    ▼
                            [감정 분석 + 공감 메시지 생성]
                                    │ ③ 결과 저장
                                    ▼
   ◀──④ 공감 메시지 표시──   [PostgreSQL (AWS)]
[히스토리 화면] ──⑤ 과거 일기 조회──▶ (DB)

[로그인 화면] ──구글 로그인──▶ [Auth.js] ──인증됨──▶ [작성/히스토리]
```

- OpenRouter 호출은 **서버(API 라우트)** 에서만 → API 키 미노출
- 로그인하지 않으면 일기 작성·조회 불가 (사용자별 데이터 분리)

## 데이터 모델 (PostgreSQL)

- `users` — id, google_sub(고유), email, name, image, created_at
- `diary_entries` — id, user_id(→users.id FK), content, emotion, empathy_message, created_at

## API 계약 (초안 — 1단계에서 확정)

- `POST /api/diary` — 요청 `{ content }` → 응답 `{ id, emotion, empathy_message, created_at }` (로그인 필요)
- `GET /api/diary` — 응답 `{ entries: [...] }` (로그인한 사용자 것만)
- `/api/auth/*` — Auth.js 구글 로그인/콜백

## AI 응답 형식

gemma에게 JSON 응답 요청: `{ "emotion": "불안", "message": "오늘 많이 힘드셨겠어요…" }`

## 챙길 포인트

- 함수 타임아웃(무료 모델 지연) → 스트리밍 또는 `maxDuration`
- 에러 처리: OpenRouter 실패/레이트리밋/JSON 파싱 실패 graceful
- UI: 따뜻하고 편안한 일기장 톤, 반응형, 접근성, 로딩/에러 상태

## 단계별 계획 (5개 에이전트)

```
[0.기획] ─▶ [1.셋업+계약] ─▶ ┌ 2A.백엔드 ┐
  (순차)       (순차)          ├ 2B.AI     ┤─▶ [3.통합] ─▶ [4.QA] ─▶ [5.배포]
                               └ 2C.프런트 ┘
                                 ⟵ 병렬 ⟶
```

| 단계 | 담당 | 브랜치 | 작업 | 커밋 메시지(예) |
|---|---|---|---|---|
| 0. 기획 | product-manager | main | PRD(목표·기능·사용자 스토리·**화면 명세**·성공 지표·일정) | `docs: PRD 작성` |
| 1. 셋업+계약 | backend-developer | main | Next.js 스캐폴드, `.gitignore`, DB 스키마, **API 계약**, Auth.js 뼈대 | `chore: 프로젝트 초기화 + 계약` |
| 2A. 백엔드 | backend-developer | feat/backend | DB 마이그레이션, Auth.js 구글, 보호된 API 라우트 | `feat(backend): 구글 로그인 + 일기 API` |
| 2B. AI | ai-integration-specialist | feat/ai | OpenRouter gemma 모듈(감정·공감) | `feat(ai): 감정분석·공감 메시지 생성` |
| 2C. 프런트 | frontend-developer | feat/ui | 로그인/작성/결과/히스토리 UI(계약 기반) | `feat(ui): 일기장 UI + 로그인/작성/히스토리` |
| 3. 통합 | backend-developer | main | 세 트랙 병합·정합 | `feat: 프런트·백엔드·AI 통합` |
| 4. QA | qa-engineer | main | 기능·엣지·인증 분리 테스트, 코드 리뷰 | `test: 통합 테스트 + 버그 수정` |
| 5. 배포 | backend-developer + 사용자 | main | Vercel 배포, 환경변수·리디렉션 URI | `chore: Vercel 배포 설정` |

## 병렬 격리

트랙별 브랜치(`feat/backend`·`feat/ai`·`feat/ui`)에서 각자 설명적 커밋 → main 병합.
파일 담당 영역: 백엔드 `app/api/**`·`lib/db`·`auth`, AI `lib/ai/**`, 프런트 `app/(pages)/**`·`components/**`.

## 사용자 준비 사항

- 구글 OAuth 자격증명 (Google Cloud Console) → `.env`의 `AUTH_GOOGLE_ID`·`AUTH_GOOGLE_SECRET`·`AUTH_SECRET`
- 승인된 리디렉션 URI: `http://localhost:3000/api/auth/callback/google`, `https://<앱>.vercel.app/api/auth/callback/google`
