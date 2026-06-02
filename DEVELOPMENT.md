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
| AI 엔진 | Anthropic Claude API (`classify-note`, `batch-classify` Edge Function) |

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
| 드래그 앤 드롭 | @dnd-kit/core + @dnd-kit/sortable |
| 푸시 알림 | Firebase Cloud Messaging (FCM) |
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
    ↓
Firebase FCM (푸시 알림)
```

---

## 디렉토리 구조

```
tongseo-front/
├── public/
│   ├── icon.svg                      # 앱 아이콘 (PWA + 파비콘)
│   ├── favicon.svg
│   └── firebase-messaging-sw.js      # FCM 백그라운드 알림 서비스 워커
├── src/
│   ├── components/
│   │   ├── AuthGuard.tsx             # 인증 가드 (RequireAuth, RequireNoAuth)
│   │   ├── SideDrawer.tsx            # 좌측 슬라이드 메뉴
│   │   ├── DailyRoutinesWidget.tsx   # 홈 Daily Routines 위젯
│   │   └── EmergencyTasksWidget.tsx  # 홈 Emergency Tasks 위젯
│   ├── contexts/
│   │   └── AuthContext.tsx           # 전역 인증 상태 관리
│   ├── hooks/
│   │   └── useFCM.ts                 # FCM 토큰 등록 훅
│   ├── lib/
│   │   ├── supabase.ts               # Supabase 클라이언트
│   │   ├── firebase.ts               # Firebase 초기화
│   │   └── uploadImages.ts           # 이미지 업로드/삭제 유틸
│   ├── pages/
│   │   ├── LoginPage.tsx             # 구글 로그인
│   │   ├── ApiKeyPage.tsx            # Claude API 키 등록
│   │   ├── HomePage.tsx              # 메인 (메모 피드 + 위젯 + 입력창)
│   │   ├── NotesPage.tsx             # 메모 목록 (전체/폴더 보기)
│   │   ├── EditNotePage.tsx          # 메모 수정
│   │   ├── ClassifyReviewPage.tsx    # 미분류 메모 일괄 분류 검토
│   │   ├── RoutinesPage.tsx          # Daily Routines 관리
│   │   ├── EmergencyTasksPage.tsx    # Emergency Tasks 관리
│   │   ├── MyPage.tsx                # 통계 및 차트
│   │   └── SettingsPage.tsx          # 설정
│   ├── types/
│   │   └── index.ts                  # 공통 타입 정의
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts                    # PWA 설정 포함
├── vercel.json                       # SPA 라우팅 설정
└── .env                              # 환경변수 (gitignore)
```

---

## 라우트 목록

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | HomePage | 메인 화면 |
| `/login` | LoginPage | 구글 로그인 |
| `/setup-api-key` | ApiKeyPage | Claude API 키 등록 |
| `/notes` | NotesPage | 메모 목록 |
| `/edit` | EditNotePage | 메모 수정 |
| `/classify-review` | ClassifyReviewPage | 미분류 일괄 분류 |
| `/routines` | RoutinesPage | Daily Routines 관리 |
| `/emergency` | EmergencyTasksPage | Emergency Tasks 관리 |
| `/mypage` | MyPage | 통계/차트 |
| `/settings` | SettingsPage | 설정 |

---

## DB 스키마

### public.users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | auth.users.id 참조 |
| email | TEXT | 구글 로그인 이메일 |
| nickname | TEXT | 표시 이름 |
| api_key | TEXT | Claude API 키 (암호화) |
| default_manual_category | TEXT | 수동 분류 기본값 |
| trash_days | INTEGER | 휴지통 보관일수 (기본 7) |
| notification_enabled | BOOLEAN | 알림 허용 여부 |
| ai_classify_enabled | BOOLEAN | AI 자동 분류 ON/OFF |
| created_at | TIMESTAMPTZ | |

### public.categories
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| name | TEXT | 카테고리 이름 |
| emoji | TEXT | |
| color | TEXT | 색상 코드 |
| is_default | BOOLEAN | 기본 카테고리 여부 (삭제 불가) |
| created_at | TIMESTAMPTZ | |

> 가입 시 DB 트리거가 `미분류(📥 #6b7280)` 카테고리 자동 생성

### public.notes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| content | TEXT | 메모 본문 |
| title | TEXT | (미사용) |
| summary | TEXT | (미사용) |
| category | TEXT | AI 분류 카테고리 |
| is_manual | BOOLEAN | 수동 분류 여부 |
| manual_category | TEXT | 수동 지정 카테고리 |
| remind_at | TIMESTAMPTZ | 알림 시각 |
| reminded_at | TIMESTAMPTZ | 알림 발송 시각 |
| image_urls | TEXT[] | 첨부 이미지 URL 배열 |
| is_emergency | BOOLEAN | 긴급 메모 여부 |
| emergency_order | INTEGER | 긴급 메모 정렬 순서 |
| is_deleted | BOOLEAN | 소프트 삭제 |
| deleted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### public.routines
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| title | TEXT | 루틴 이름 |
| days | INTEGER[] | 반복 요일 (0=일 ~ 6=토) |
| sort_order | INTEGER | 표시 순서 |
| created_at | TIMESTAMPTZ | |

### public.routine_checks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | |
| routine_id | UUID | |
| user_id | UUID | |
| checked_date | DATE | 체크한 날짜 (YYYY-MM-DD) |
| created_at | TIMESTAMPTZ | |

> UNIQUE(routine_id, checked_date) 제약으로 중복 방지

### public.device_tokens
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | |
| user_id | UUID | |
| token | TEXT | FCM 토큰 |
| platform | TEXT | 'web' 또는 'android' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Storage
- 버킷명: `note-images` (Public)
- 경로: `{user_id}/{timestamp}_{random}.{ext}`
- 정책: 인증 사용자 INSERT/DELETE, 전체 공개 SELECT

---

## Edge Functions

| 함수명 | 설명 |
|--------|------|
| `classify-note` | 메모 내용 → Claude API → `{ category, remind_at }` 반환 |
| `batch-classify` | 미분류 메모 일괄 분류 → 결과 반환 (DB 저장 안 함) |
| `update-api-key` | Claude API 키 AES-256-GCM 암호화 저장 |
| `send-notification` | FCM 푸시 알림 발송 (pg_cron 자동 호출) |

---

## 주요 기능

### 메인 화면 (HomePage)
- **날짜/시각 헤더**: `5월 21일 수요일 14:32` — 1분마다 자동 갱신
- **Daily Routines 위젯**: 오늘 요일 루틴 표시, 체크 시 줄그음 처리 (노란 테마)
- **Emergency Tasks 위젯**: 긴급 메모 목록 (빨간 테마), 없으면 자동 숨김
- **메모 피드**: 전체 메모 스크롤 목록 (updated_at 내림차순), 긴급 메모 제외
- **입력창**: 하단 고정, AI 자동분류 / 수동분류 / 이미지 첨부 / 알림 토글
- **긴급 등록**: 🚨 버튼으로 즉시 Emergency Tasks로 이동

### 메모 작성
- AI 자동분류 (Claude API) / 수동 카테고리 선택 토글
- 이미지 복수 첨부 (미리보기, 제거)
- 텍스트 없이 이미지만으로도 저장 가능
- 알림 ON/OFF 토글 (remind_at 저장)
- Ctrl+Enter 단축키

### 메모 목록 (NotesPage)
- 전체 보기 (날짜별 그룹) / 폴더 보기 (카테고리별)
- 실시간 검색
- 카테고리 뱃지 클릭 → 인라인 드롭다운으로 카테고리 변경
- 🚨 긴급 등록/해제 버튼
- 이미지 썸네일 표시
- 하단 고정 "작성하기" 버튼

### Daily Routines
- **홈 위젯**: 오늘 요일 루틴만 표시, 체크박스 터치로 완료/해제
- **관리 페이지** (`/routines`): 추가/수정/삭제, 드래그 정렬
- **요일 설정**: 매일/평일/주말 빠른 선택 + 요일별 개별 토글
- **체크 기록**: 날짜별 누적 저장 (routine_checks 테이블)

### Emergency Tasks
- **홈 위젯**: 긴급 메모 전체 표시 (emergency_order 순), ✕로 해제
- **관리 페이지** (`/emergency`): 새 긴급 메모 작성, 드래그 정렬
- **복구 버튼**: 원래 카테고리로 복구 (is_emergency = false)
- **등록 방법**: 메모 카드 🚨 버튼 또는 Emergency Tasks 메뉴에서 직접 추가

### AI 자동분류 관리
- 설정에서 전역 AI 분류 ON/OFF 토글
- OFF 시 `default_manual_category` 또는 '미분류'로 자동 저장
- **미분류 일괄 분류** (`/classify-review`): `batch-classify` 호출 → 결과 검토 → 분류 확정

### 설정 (SettingsPage)
- 계정: 이메일, 닉네임 수정, 로그아웃
- AI 설정: 자동분류 ON/OFF, API 키 변경, 기본 카테고리, 미분류 일괄 분류
- 알림: 알림 허용 토글
- 카테고리 관리: 추가/수정/삭제 (이모지 12개, 컬러 10개 프리셋), `미분류` 삭제 불가
- 휴지통: 보관 기간 슬라이더 (1~15일), 비우기
- 데이터 관리: JSON 내보내기, 계정 삭제
- 앱 정보: 버전

### FCM 웹 푸시 알림
- Firebase 프로젝트: `tongseo-e5d28`
- 로그인 후 알림 권한 요청 → FCM 토큰 발급 → `device_tokens` 저장
- 포그라운드: `onMessage`로 브라우저 알림
- 백그라운드: `firebase-messaging-sw.js` 서비스 워커
- pg_cron이 매분 `remind_at` 도달한 메모에 자동 발송

### PWA
- 홈 화면에 앱으로 설치 가능 (Android Chrome, iOS Safari)
- 오프라인 앱 셸 캐싱 (Workbox)
- Supabase API NetworkFirst 캐싱
- 다크 테마 앱 아이콘

---

## 환경변수

```env
# Supabase
VITE_SUPABASE_URL=https://faedgurunvtdygzpzsnn.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=tongseo-e5d28.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tongseo-e5d28
VITE_FIREBASE_STORAGE_BUCKET=tongseo-e5d28.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=376390993636
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

Vercel 대시보드 → Settings → Environment Variables 에도 동일하게 등록 필요.

---

## 인증 흐름

```
Google OAuth 로그인
    ↓
DB 트리거: public.users 자동 생성 + 미분류 카테고리 생성
    ↓
AuthContext: session → profile 로드 (2-Effect 패턴)
    ↓
hasApiKey 확인 → 없으면 /setup-api-key 리다이렉트
    ↓
FCM 토큰 발급 및 등록 (useFCM 훅)
```

---

## 자동화된 백엔드 동작

| 동작 | 주기 | 내용 |
|------|------|------|
| 휴지통 자동 삭제 | 매일 KST 자정 | trash_days 만료 메모 영구 삭제 |
| 알림 자동 발송 | 매분 | remind_at 도달한 메모에 FCM 푸시 발송 |

---

## 주요 해결 이슈

| 이슈 | 원인 | 해결 |
|------|------|------|
| 무한 로딩 | onAuthStateChange 내 REST 호출 시 세션 미커밋 | Effect 1 (세션) / Effect 2 (프로필) 분리 |
| TS 빌드 오류 | verbatimModuleSyntax + ReactNode | `import type` 사용 |
| 이미지 썸네일 깨짐 | Storage 버킷 Private 상태 | `UPDATE storage.buckets SET public = true` |
| Google OAuth 404 | Supabase URL Configuration 오류 | Site URL / Redirect URLs 정확히 입력 |
| Firebase 초기화 오류 | Vercel 환경변수 미등록 | 환경변수 등록 + 방어 코드 추가 |

---

## 커밋 히스토리

```
432d241 fix: Daily Routines 위젯 스크롤 제거
6bf980f fix: Emergency Tasks 위젯 스크롤 제거
c0fedaa feat: Emergency Tasks 메뉴 페이지 (드래그 정렬, 복구)
2182d36 feat: 긴급 메모 피드 분리, 즉시 반영
08be64d feat: Emergency Tasks 위젯 및 🚨 토글 기능
3a4220c style: Daily Routines 노란 테두리 테마
c21e015 feat: Daily Routines 기능 추가
2eefec7 style: 다크 테마 스크롤바
fc9e4a8 feat: 홈 메모 피드 스크롤 + 입력창 하단 고정
06012d6 feat: FCM 웹 푸시 알림, batch-classify 적용
af9425d feat: 신규 유저 미분류 카테고리 자동 생성
ca0057f feat: AI 자동분류 ON/OFF, 미분류 일괄분류, 카테고리 인라인 변경
2fcbe9b feat: 메모 이미지 첨부 기능
dcdf043 feat: 메모 목록 하단 작성하기 버튼
228c026 feat: 드로어 작성하기 버튼, 메뉴 구조 개선
d46d9c0 feat: 홈 최근 메모 피드 + 노트 카드 컴팩트화
e4a953d feat: 통서 PWA 프론트엔드 초기 구현
```
