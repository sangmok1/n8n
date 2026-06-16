# 한국어 UI — 설정에서 언어 선택

## 사용 방법 (API 키 불필요)

1. n8n 실행 후 로그인
2. **Settings → Personal → Personalisation → Language**
3. **English** / **Korean** 선택 → 즉시 반영 (브라우저에 저장)

기본은 **English**입니다. 한국어를 고르면 `ko.json`에 번역된 문구만 한국어로 보이고, 없는 항목은 영어로 표시됩니다.

## UI 문구 번역 채우기 (선택, Gemini)

```bash
# 키는 .env.local 에만 넣기 (Git 제외). 채팅/커밋에 넣지 마세요.
echo 'GEMINI_API_KEY=your-key' >> .env.local
echo 'GEMINI_MODEL=gemini-2.5-flash' >> .env.local
pnpm exec dotenvx run -f .env.local -- pnpm translate:ko
```

키 발급: https://aistudio.google.com/apikey  
**챗봇/Cursor에 키를 넣을 필요 없습니다.**

## 개발 서버

```bash
cd packages/cli && pnpm dev
# 프론트 HMR: cd packages/frontend/editor-ui && pnpm dev → http://localhost:8080
```

## 워크플로 AI (채팅으로 워크플로 만들기)

사이드바 **워크플로 AI** (기존 채팅 메뉴 대체)에서 자연어로 워크플로를 생성합니다.

1. **Settings → Personal → Workflow AI (Gemini)** 에서 API 키 저장  
   또는 `.env.local`에 `N8N_INSTANCE_AI_MODEL=google/gemini-2.5-flash` 와 `N8N_INSTANCE_AI_MODEL_API_KEY` 설정
2. 백엔드 재시작 (`packages/cli`에서 `pnpm dev`)
3. 사이드바 **워크플로 AI** 열기 → 예: `한국시간 오전 9시에 디스코드로 메시지 보내는 워크플로 만들어줘`

## 아직 영어인 부분

- `ko.json`에 없는 UI 문자열
- 워크플로 노드·크레덴셜 상세 (별도 `translations/ko/`)
