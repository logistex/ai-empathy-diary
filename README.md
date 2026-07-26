# AI 공감 다이어리 (AI Empathy Diary)

오늘 있었던 일을 **한 줄로 쓰면**, AI가 **감정을 분석하고 공감하며 위로**해 주는 일기 애플리케이션입니다.

## 기술 스택

- **프레임워크**: Next.js (App Router) — 프런트엔드 + API 라우트
- **배포**: Vercel
- **데이터베이스**: PostgreSQL (AWS)
- **AI**: OpenRouter API → `google/gemma-4-31b-it:free` (무료 모델)
- **인증**: Auth.js (NextAuth) — 구글 계정 로그인

## 주요 기능

- 구글 계정으로 로그인
- 한 줄 일기 작성 → AI 감정 분석 + 공감/위로 메시지
- 사용자별 일기 히스토리 저장·조회

## 배포

- 프로덕션: **https://ai-empathy-diary-two.vercel.app** (Vercel, `git push` 시 자동 배포)

## 문서

- [사용자 매뉴얼](docs/USER_MANUAL.md) — 앱 사용법
- [개발자 문서](docs/DEVELOPMENT.md) — 셋업·실행·배포·트러블슈팅
- [API 계약](docs/API.md) · [PRD](docs/PRD.md) · [작업 계획](docs/PLAN.md)
- 아키텍처·설계 결정: [`CLAUDE.md`](CLAUDE.md)

## 환경변수

`.env` 파일에 다음 값이 필요합니다 (`.env.example` 참고, **`.env`는 커밋 금지**):

- `OPENROUTER_API_KEY` — OpenRouter API 키
- `DATABASE_URL` — PostgreSQL 접속 주소
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — 구글 OAuth 자격증명
- `AUTH_SECRET` — Auth.js 세션 암호화 키
