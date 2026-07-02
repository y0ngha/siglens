# 분석 결과 공유 기능 실증 Test Case (이슈 #367)

- 작성일: 2026-06-30
- 브랜치: `feat/367/분석-결과-공유`
- 목적: 코드/E2E 테스트가 커버하는 것을 넘어, **prod처럼 빌드·실행한 실제 동작**을 curl + 크롬 양방향으로 검증.

## 변경 범위 요약

| 영역 | 변경 |
|---|---|
| DB | `shared_analyses` 테이블 + `shareable_kind` enum (migration 0022) |
| 도메인/인프라 | `entities/shared-analysis` (lib·server registry·repo·2 actions) |
| 상태 공유 | `features/share` (ShareableAnalysisContext + register, 8 위젯 + 5 훅) |
| UI | `widgets/share` (ShareButton·ShareSheet·ShareTriggerDialog·SharePreparingModal·kindPanelRegistry) |
| 라우트 | `/share/[id]` page + error.tsx + opengraph-image (force-dynamic) |
| 헤더 | `SymbolLayoutHeader`에 ShareButton, `SymbolLayoutClient`에 Provider |

## 검증 방법

prod 빌드(`yarn build`) 후 prod 서버 실행. **(1) curl** 로 응답/status/메타 확인, **(2) 크롬** 으로 렌더·인터랙션 확인.

---

## TC-1: 헤더 공유 버튼 노출 (모든 [symbol] 탭)
- **기대**: chart/overall/news/fundamental/financials/congress/options/fear-greed 전 탭 헤더에 `aria-label="분석 결과 공유"` 버튼이 ModelSelector 옆에 렌더.
- **curl**: `curl -s http://localhost:PORT/AAPL | grep -c '분석 결과 공유'` ≥ 1. 다른 탭(`/AAPL/news` 등)도 동일.
- **크롬**: 각 탭 방문 → 헤더 우측에 공유 아이콘 버튼 보임, 포커스 링 동작.

## TC-2: 공유 생성 흐름 (상태머신)
- **기대**:
  - 분석이 이미 있는 탭에서 공유 클릭 → 스냅샷 생성 → 데스크톱 팝오버(복사/X) 또는 모바일 native share.
  - 분석 없는 탭에서 클릭 → ShareTriggerDialog("공유하기 전에 분석을 준비할게요") → 확인 → SharePreparingModal → 완료 시 자동으로 공유 시트.
  - unavailable(no_trades/빈 옵션) → 인라인 안내, 버튼 비활성 아님.
- **크롬**: 분석 완료된 심볼에서 공유 클릭 → 팝오버 노출, 링크 복사 시 "복사됨" + aria-live. 분석 없는 심볼에서 컨펌 다이얼로그 → 확인 → 로딩 모달.

## TC-3: /share/[id] 페이지 렌더
- **기대**: 공개(로그인 불필요), 읽기전용 AI 패널 + "as of {시각}" disclaimer + 투자 면책 박스 + "Siglens에서 {TICKER} 직접 분석하기" CTA(`/{symbol}` 링크).
- **curl**: 실제 공유 id로 `curl -s .../share/{id}` → 200, 패널/disclaimer/CTA 텍스트 존재.
- **크롬**: 공유 생성 후 받은 URL 방문 → 패널·disclaimer·CTA 렌더, 인터랙션(재분석 버튼) 없음.

## TC-4: OG / 메타 / noindex
- **기대**: `<title>{TICKER} AI 분석 결과`, `og:title`/`og:description`/`twitter:card=summary_large_image`, `robots: noindex,nofollow`, OG 이미지 라우트가 PNG 반환.
- **curl**:
  - `curl -s .../share/{id} | grep -E 'og:title|twitter:card|noindex|robots'`
  - `curl -sI .../share/{id}/opengraph-image` → `content-type: image/png`, 200.

## TC-5: 만료 / notFound 빈 상태
- **기대**: 존재하지 않는 id → "이 공유 링크는 만료됐어요" + 홈/심볼 CTA, noindex, 500 아님.
- **curl**: `curl -s .../share/nonexistent-id-xyz` → 200(또는 정상 빈상태), "만료" 카피, noindex 메타. `curl -sI` 서버 에러(5xx) 없음.
- **크롬**: 임의 id 방문 → 빈 상태 페이지 + CTA.

## TC-6: 안정성 (fail-open)
- **기대**: 잘못된/긴 id, DB 경계에서도 500 raw 에러 없이 graceful(not_found/error 바운더리).
- **curl**: `curl -sI .../share/$(python3 -c "print('x'*500)")` → 5xx 아님.

## TC-7: 빌드/라우트 등록
- **기대**: `yarn build` exit 0, `/share/[id]`·`/share/[id]/opengraph-image`가 `ƒ`(Dynamic)로 등록.

---

## 결과 기록 (2026-06-30~07-01 prod 빌드+실행 실증)

prod 빌드(`yarn build`, exit 0) → `next start`(:3100) + worker(:8080) + 로컬 Neon DB로 실증. curl + 크롬 양방향.

| TC | 결과 | 근거 |
|---|---|---|
| TC-1 헤더 공유 버튼(전 탭) | ✅ PASS | `/AAPL`·`/AAPL/news` HTML에 `aria-label="분석 결과 공유"` 1건; 크롬에서 ModelSelector 옆 아이콘 확인 |
| TC-2 공유 흐름 | ✅ PASS | error 상태→공유 클릭→ShareTriggerDialog→"분석하고 공유하기"→재분석 trigger→SharePreparingModal→**재분석 완료(worker Gemini)→auto-advance→공유시트(링크복사/X)**. 전 흐름 크롬 실증 |
| TC-3 found 페이지 | ✅ PASS | `/share/DxBHiYcfRN3fFOqsikssOg`: 헤더(워드마크+티커+kind칩)+disclaimer("…기준·스냅샷")+읽기전용 AnalysisPanel(약세, 지표/패턴/전략)+투자면책 박스+CTA(`/AAPL`) 전부 렌더 |
| TC-4 OG/메타/noindex | ✅ PASS | OG 라우트 200 `content-type: image/png`; 페이지 `noindex`, `<title>… AI 분석 결과` |
| TC-5 만료/notFound | ✅ PASS | `/share/nonexistent` 200(빈상태 "이 공유 링크는 만료됐어요"+CTA), noindex |
| TC-6 fail-open | ✅ PASS | mixed-case id·400자 long id 모두 200(5xx·대문자 301 없음) |
| TC-7 빌드/라우트 | ✅ PASS | `yarn build` exit 0, `/share/[id]`·OG가 `ƒ`(Dynamic) |

### 실증으로 발견·수정한 버그 (테스트·빌드·6라운드 감사 모두 미검출)
1. **`proxy.ts` `/share` 미예약** → middleware의 ticker 대문자 정규화가 `/share/<id>`를 `/SHARE/<id>`로 301→404, base64url id 손상. `RESERVED_FIRST_SEGMENTS`에 `'share'` 추가 (`67bc88b3`).
2. **RSC client-reference 누락** → `page.tsx`(RSC)가 `'use client'` 모듈의 plain object에서 익명 화살표 컴포넌트를 추출해 렌더 → RSC 경계서 `undefined`("Element type is invalid"). named `ShareKindPanel` 클라 디스패처로 수정 (`be403c37`).

두 버그 모두 단위/E2E 테스트가 닿지 않는 경계(middleware, RSC 직렬화)라 **실제 prod 실행 실증으로만** 발견됨.
