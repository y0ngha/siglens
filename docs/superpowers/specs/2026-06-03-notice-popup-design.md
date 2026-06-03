# 공지사항 팝업 기능 설계

- 작성일: 2026-06-03
- 브랜치: `feat/notice-popup`
- 상태: 설계 승인 대기 → 구현 계획(writing-plans)으로 전환 예정

## 1. 목적 & 배경

긴급 공지를 사이트 전체(또는 특정 경로)에 빠르게 띄우기 위한 팝업 기능.
관리자 UI 없이 DB row를 직접 INSERT/UPDATE 하는 것만으로 즉시 노출/회수할 수 있어야 한다.
사용자는 "다시 보지 않기"로 특정 공지를 localStorage에 기록해 재노출을 막을 수 있다.

### 핵심 의사결정 (brainstorming 합의)

| 항목 | 결정 |
|---|---|
| 관리 방식 | **DB 직접 입력** (관리자 UI 없음). 긴급 공지는 SQL 한 줄로 처리 |
| 노출 제어 차원 | 활성/비활성 토글 + 노출 시작/종료 시각 + 페이지 경로 타게팅 |
| 사용자 타게팅 | **제외** (비회원도 모든 기능을 쓰는 서비스 특성) |
| 표시 형태 | **중앙 모달** (dimmed backdrop) |
| 다중 공지 | **우선순위 순 모두 순차 표시** (하나 닫으면 다음) |
| 닫기 동작 | **'다시 보지 않기'(영구) + 'X 닫기'(임시) 분리** |
| 콘텐츠 | 제목 + 본문(**마크다운**) + 선택 링크 1개 + 작성일 표시 |
| 캐싱 | `no-store` (긴급 즉시 반영 우선) |

## 2. 데이터 모델 — `notices` 테이블

`src/shared/db/schema.ts`에 기존 `terms` 테이블 스타일을 그대로 따라 추가.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | `uuid` PK `defaultRandom()` | 공지 ID. localStorage dismiss 키로도 사용 |
| `title` | `varchar(NOTICE_TITLE_MAX_LENGTH)` `notNull` | 제목 (길이 상수 파일 상단 정의) |
| `body` | `text` `notNull` | 본문 (마크다운) |
| `link_url` | `text` nullable | 선택 링크 URL |
| `link_label` | `text` nullable | 링크 라벨 (없으면 URL 노출) |
| `path_pattern` | `text` nullable | 경로 타게팅. `null`=전역. 예: `/`, `/symbol/*` |
| `priority` | `integer` `notNull` `default(0)` | 클수록 먼저 노출 |
| `is_active` | `boolean` `notNull` `default(true)` | 활성 토글 |
| `starts_at` | `timestamptz` nullable | 노출 시작 (null=즉시) |
| `ends_at` | `timestamptz` nullable | 노출 종료 (null=무기한) |
| `created_at` | `timestamptz` `notNull` `defaultNow()` | 작성일 (모달에 표시) |
| `updated_at` | `timestamptz` `notNull` `defaultNow().$onUpdateFn(nowFn)` | 수정일 |

인덱스:
- `notices_active_window_idx` on `(is_active, starts_at, ends_at)` — 활성 공지 조회 최적화

### 경로 매칭 규칙

`path_pattern`은 단순 3종만 지원 (정규식 제외 — 과한 복잡도):

1. `null` 또는 `/*` → **전역** (모든 경로)
2. 와일드카드 없음 (예: `/about`) → **정확 일치**
3. `/prefix/*` (예: `/symbol/*`) → **접두 일치** (`/symbol`, `/symbol/AAPL` 등)

매칭은 클라이언트 `matchPath(pattern, pathname)` 순수함수로 수행.

## 3. 아키텍처 (FSD 레이어)

```
src/entities/notice/
├── api.ts                         DrizzleNoticeRepository.findActive() — DB 쿼리 (server-only)
├── actions/
│   └── getActiveNoticesAction.ts  'use server' — 활성 공지 목록 반환
├── actions.ts                     배럴 (re-export, 'use server' 없음)
├── model/
│   └── types.ts                   Notice 타입 (클라이언트 안전 직렬화 형태)
├── lib/
│   ├── matchPath.ts               경로 매칭 순수함수
│   └── noticeStorage.ts           localStorage dismiss 읽기/쓰기 (typeof window 가드)
├── __tests__/
│   ├── matchPath.test.ts
│   ├── noticeStorage.test.ts
│   └── api.test.ts                노출 필터(SQL where 조건) 통합 테스트
└── index.ts                       공개 배럴 (server-only api.ts 제외)

src/widgets/notice-popup/
├── ui/
│   └── NoticePopup.tsx            'use client' — 모달, 순차 표시, useDialog 재사용
├── __tests__/
│   └── NoticePopup.test.tsx       렌더/상호작용 테스트
└── index.ts
```

마운트 위치: `src/app/layout.tsx`의 `<ReactQueryProvider>` 내부 (`<PwaBanner />` 인근).

### 레이어 의존 방향 점검

- `widgets/notice-popup` → `entities/notice` (정방향, OK)
- `entities/notice`는 `shared/db`, `shared/ui/MarkdownText`, `shared/hooks/useDialog` 사용 (정방향, OK)
- `app/layout.tsx` → `widgets/notice-popup` (정방향, OK)
- production 코드는 슬라이스 배럴(`@/entities/notice`, `@/widgets/notice-popup`)만 import

## 4. 데이터 플로우 & 노출 로직

1. **서버** `getActiveNoticesAction()`:
   ```sql
   WHERE is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (ends_at   IS NULL OR ends_at   >= now())
   ORDER BY priority DESC, created_at DESC
   ```
   - DB 클라이언트는 `tryGetDatabaseClient()` 사용 → 미설정/실패 시 빈 배열 (공지는 non-critical)
   - 반환 타입은 클라이언트 안전한 직렬화 형태(날짜는 ISO 문자열 또는 epoch)

2. **클라이언트** `NoticePopup`:
   - 마운트 시 server action으로 활성 공지 fetch
   - `usePathname()` + `matchPath`로 현재 경로에 맞는 공지만 필터
   - `noticeStorage`에서 "다시 보지 않기"한 ID 제외
   - 남은 공지를 우선순위 순 큐로 → 하나씩 모달 표시
   - X/배경 클릭(임시 닫기) → 컴포넌트 state로만 큐 진행 (새로고침 시 다시 노출)
   - "다시 보지 않기" → `noticeStorage`에 ID 영구 저장 후 큐 진행

## 5. UI/UX

- 중앙 모달, dimmed backdrop. 기존 `useDialog`(escape / focus-trap / click-outside) + `IosInstallModal` 스타일 재사용
- 본문은 `@/shared/ui/MarkdownText`로 렌더 (react-markdown, rehype-raw 미사용 → raw HTML 무시되어 XSS 안전)
- `created_at`을 `YYYY.MM.DD 작성` 형태로 표시
- `link_url`이 있으면 링크 버튼 노출 (라벨 = `link_label ?? link_url`). 외부 링크는 `rel="noopener noreferrer"`, 적절한 `target`
- 하단 액션 2개: "다시 보지 않기"(영구 dismiss) / "닫기"(임시)
- 접근성: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(제목 id), 포커스 트랩, Esc 닫기(= 임시 닫기)

## 6. 캐싱 · 에러 처리

- **캐싱**: server action은 `no-store` (긴급 공지 즉시 반영). 활성 공지가 보통 0~1건이라 layout 부하 미미
- **에러 처리**:
  - DB/네트워크 실패 → 조용히 미표시 (공지는 부가 기능, 페이지 동작 방해 금지)
  - localStorage 접근/파싱 실패 → try/catch 무시 (기존 `chatStorage` 패턴)
  - 손상된 dismiss 데이터 → 빈 배열로 graceful fallback

## 7. 테스트 전략

> 요구사항: **변경/추가 파일의 커버리지 90% 이상**, happyPath 외 worstCase·통합·E2E 추가.

### 단위 (vitest)
- `matchPath.test.ts`
  - happy: 전역(`null`, `/*`), 정확 일치, 접두 일치
  - worst: 패턴 불일치, 빈 문자열, 접두인데 부분만 겹치는 경로(`/symbolize` ≠ `/symbol/*`), trailing slash, 대소문자
- `noticeStorage.test.ts`
  - happy: 저장/조회, 중복 ID 저장
  - worst: `window` 없음(SSR), JSON 손상 데이터, quota 초과, 비배열 데이터
- `NoticePopup.test.tsx`
  - happy: 단일 공지 렌더(제목/본문/작성일/링크), 닫기→다음 공지
  - worst: 공지 없음(렌더 안 함), 모두 dismiss됨, 경로 불일치, 마크다운 본문 렌더, 링크 없는 공지

### 통합 (vitest)
- `api.test.ts` (`entities/notice`): `findActive`가 is_active / 시간창 / 정렬을 SQL 레벨에서 올바르게 거르는지 (테스트 DB 또는 mock 쿼리 빌더)

### E2E (Playwright)
> 기존 Tier 1~4 E2E 스위트 패턴(`workers:1`, HYBRID 백엔드, 쿠키 seam) 따름.
- 활성 공지 1건 seed → 첫 방문 시 모달 노출 확인
- "다시 보지 않기" 클릭 → 재방문 시 미노출 (localStorage 영속)
- "X 닫기" → 새로고침 시 재노출 (임시)
- 다중 공지: 우선순위 순 순차 노출
- 경로 타게팅: 매칭 경로에서만 노출

E2E seed는 기존 스위트의 DB seed 방식 또는 쿠키 seam을 따른다 (구현 계획에서 확정).

## 8. 마이그레이션

1. `src/shared/db/schema.ts`에 `notices` 테이블 + 길이 상수 추가
2. `yarn drizzle-kit generate` → `drizzle/000X_*.sql` 생성 후 커밋
3. 적용(`migrate`)은 배포 환경에서 수행

## 9. YAGNI / 범위 밖 (의도적 제외)

- 관리자 CRUD UI (DB 직접 입력으로 충분)
- 사용자/티어 타게팅
- 정규식 경로 매칭
- 본문 HTML/이미지 첨부 (마크다운으로 충분)
- 공지 읽음 통계/분석
- 다국어 공지 (현재 단일 로케일)

## 10. siglens-core 범위 점검

이 기능은 **분석 도메인이 아니라 siglens 앱의 UI + DB I/O 기능**이다.
인디케이터/시그널/캔들/AI 프롬프트와 무관하므로 siglens-core 대상이 아니며, siglens 로컬에서 구현하는 것이 맞다.
(외부세계 연결 = DB I/O는 siglens 책임이라는 원칙과도 일치.)
