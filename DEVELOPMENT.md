# 통서(通書) 프론트엔드 개발 문서

> 메모를 입력하면 AI가 자동으로 분류해주는 스마트 메모 PWA

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 통서(通書) |
| 배포 URL | https://tongseo-front.vercel.app |
| GitHub | https://github.com/G-moog/tongseo-front |
| 프론트엔드 호스팅 | Vercel |
| 백엔드 | Supabase (DB + Auth + Edge Functions + Storage) |
| AI 엔진 | Anthropic Claude API (`classify-note` Edge Function) |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| UI 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) |
| 라우팅 | React Router v6 |
| 백엔드 클라이언트 | @supabase/supabase-js v2 |
| 차트 | recharts (PieChart, BarChart) |
| PWA | vite-plugin-pwa (Workbox) |

---

## 인프라 구조

```
사용자 (모바일/PC)
    ↓
Vercel (React PWA)
    ↓
Supabase (DB + Auth + Edge Functions + Storage)
    ↓
Anthropic Claude API (AI 자동 분류)
```

---

## 디렉토리 구조

```
tongseo-front/
├── public/
│   ├── icon.svg              # 앱 아이콘 (PWA + 파비콘)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AuthGuard.tsx     # 인증 가드 (RequireAuth, RequireNoAuth)
│   │   ├── SideDrawer.tsx    # 좌측 슬라이드 메뉴
│   │   └── BottomNav.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx   # 전역 인증 상태 관리
│   ├── lib/
│   │   ├── supabase.ts       # Supabase 클라이언트 초기화
│   │   └── uploadImages.ts   # 이미지 업로드/삭제 유틸
│   ├── pages/
│   │   ├── LoginPage.tsx     # 구글 로그인
│   │   ├── ApiKeyPage.tsx    # Claude API 키 등록
│   │   ├── HomePage.tsx      # 메인 (메모 작성 + 최근 피드)
│   │   ├── NotesPage.tsx     # 메모 목록 (전체/폴더 보기)
│   │   ├── EditNotePage.tsx  # 메모 수정
│   │   ├── MyPage.tsx        # 통계 및 차트
│   │   └── SettingsPage.tsx  # 설정
│   ├── types/
│   │   └── index.ts          # 공통 타입 정의
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts            # PWA 설정 포함
├── vercel.json               # SPA 라우팅 설정
└── .env                      # Supabase 환경변수 (gitignore)
```

---

## 주요 기능

### 인증
- Google OAuth (Supabase Auth)
- 로그인 후 Claude API 키 미등록 시 `/setup-api-key` 리다이렉트
- 인증 상태: `undefined`(판단 중) / `null`(미로그인) / `Session`(로그인) 3단계 tri-state
- 세션 감지(Effect 1)와 프로필 로딩(Effect 2) 분리 — 무한 로딩 방지

### 메모 작성 (HomePage)
- 화면 상단: 최근 메모 5개 피드 (수정/삭제 버튼 포함)
- 하단 고정 입력창
- ✨ 자동분류 / 수동 카테고리 선택 토글
- 🔔 알림 ON/OFF 토글 (AI가 감지한 일정 알림)
- 🖼️ 이미지 첨부 (복수 선택, 미리보기, 제거)
- 텍스트 없이 이미지만으로도 메모 등록 가능
- Ctrl+Enter 단축키 전송
- 저장 후 토스트 메시지

### 메모 목록 (NotesPage)
- 전체 보기: 날짜별 그룹핑
- 폴더 보기: 카테고리별 폴더
- 실시간 검색 (내용/제목/요약)
- 메모 카드: 카테고리 뱃지 + 시간 + 내용 2줄 + 이미지 썸네일
- 하단 고정 "작성하기" 버튼

### 메모 수정 (EditNotePage)
- 기존 내용 불러와 수정
- 기존 이미지 유지/제거 + 새 이미지 추가
- AI 재분류 또는 수동 카테고리 변경

### 마이페이지 (MyPage)
- 총 메모 수 / 이번 달 / 연속 작성 일수
- 카테고리별 도넛 차트 (recharts)
- 최근 4주 바 차트
- 시간대별 (아침/오후/저녁/밤) 수평 바
- AI 자동 vs 수동 분류 비율

### 설정 (SettingsPage)
- 계정: 이메일, 닉네임 수정, 로그아웃
- AI 설정: Claude API 키 변경, 기본 카테고리
- 알림: 알림 ON/OFF 토글
- 카테고리 관리: 추가/수정/삭제 (이모지 12개, 컬러 10개 프리셋)
- 휴지통: 자동 삭제 기간 슬라이더 (1~15일)
- 데이터 관리: JSON 내보내기, 계정 삭제

### 사이드 드로어
- 좌측 슬라이드 메뉴 (ESC / 오버레이 클릭으로 닫기)
- 메뉴: ✏️ 작성하기 → 📋 전체 보기 → 🗂️ 폴더 보기 → 👤 마이페이지 → ⚙️ 설정

### 이미지 업로드
- Supabase Storage (`note-images` 버킷)
- 경로: `{user_id}/{timestamp}_{random}.{ext}`
- 버킷 정책: 인증 사용자 업로드/삭제, 전체 공개 읽기
- 메모 카드에 썸네일 가로 스크롤 표시

### PWA
- `vite-plugin-pwa` + Workbox 서비스워커
- 오프라인 앱 셸 캐싱 (JS/CSS/HTML/SVG)
- Supabase API NetworkFirst 캐싱 (5초 타임아웃)
- 모바일 Chrome "홈 화면에 추가" 지원
- 다크 테마 앱 아이콘 (노트 + 연필 SVG)

---

## 환경변수 (.env)

```
VITE_SUPABASE_URL=https://faedgurunvtdygzpzsnn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Vercel 대시보드 → Settings → Environment Variables 에도 동일하게 등록.

---

## Supabase 설정

### 필요 테이블
| 테이블 | 주요 컬럼 |
|--------|-----------|
| `users` | id, email, nickname, api_key, default_manual_category, trash_days, notification_enabled |
| `notes` | id, user_id, content, title, summary, category, is_manual, manual_category, remind_at, is_deleted, deleted_at, image_urls, created_at, updated_at |
| `categories` | id, user_id, name, emoji, color, is_default, created_at |

### Storage
- 버킷명: `note-images` (Public)
- 정책: 인증 사용자 INSERT/DELETE, 전체 공개 SELECT

### Edge Functions
- `classify-note`: 메모 내용 → Claude API → 카테고리/제목/요약/remind_at 반환
- `update-api-key`: Claude API 키 AES-256-GCM 암호화 저장

---

## 배포

```bash
# GitHub에 push → Vercel 자동 배포
git add .
git commit -m "커밋 메시지"
git push
```

---

## 주요 해결 이슈

### 1. 무한 로딩 (인증)
- **원인**: `onAuthStateChange` 콜백 내부에서 Supabase REST API 호출 시 세션 미커밋으로 401 반환
- **해결**: Effect 1 (세션 감지) / Effect 2 (프로필 로딩) 분리, React 렌더 이후 실행 보장

### 2. TypeScript 빌드 오류
- `ReactNode` → `import type { ReactNode }` (verbatimModuleSyntax)
- Supabase insert 유니온 타입 → `as never` 캐스팅
- 미사용 변수 (`navigate`) 제거

### 3. PWA 이미지 썸네일 깨짐
- **원인**: Storage 버킷이 Private 상태
- **해결**: `UPDATE storage.buckets SET public = true WHERE id = 'note-images'`

### 4. Google OAuth 리다이렉트 404
- **원인**: Supabase URL Configuration에 잘못된 URL 등록
- **해결**: Site URL / Redirect URLs 정확히 입력

---

## 커밋 히스토리

```
06ac1a0 fix: 앱 전체 통서 → 통서(通書)로 변경
ba445c8 fix: 브라우저 탭 타이틀 통서(通書)로 변경
72bf74b fix: 버킷 public 안내, 이미지만으로 메모 등록 허용
2fcbe9b feat: 메모 이미지 첨부 기능 추가 (Supabase Storage)
54c97a0 style: 작성하기 버튼 보라색, 텍스트만, 하단 여백 조정
dcdf043 feat: 메모 목록 하단에 작성하기 버튼 추가
228c026 feat: 드로어에 작성하기 버튼 추가, 마이페이지/설정 위치 조정
3c20982 feat: 홈 최근 메모 카드에 수정/삭제 버튼 추가
08a75f8 fix: 메모 목록에서 제목/요약 숨김
708592e fix: 최근 메모 피드 상단 이동, 제목/요약 숨김
d46d9c0 feat: 홈 최근 메모 피드 추가 및 노트 카드 컴팩트화
e4a953d feat: 통서 PWA 프론트엔드 초기 구현
```
