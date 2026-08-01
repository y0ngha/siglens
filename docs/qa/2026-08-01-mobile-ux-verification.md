# 모바일 [symbol] UI/UX 수정 — 실증 기록 (2026-08-01)

- 브랜치: `fix/mobile-ux-input-and-snapshot-clarity`
- 설계: [`../superpowers/specs/2026-08-01-mobile-ux-fixes-design.md`](../superpowers/specs/2026-08-01-mobile-ux-fixes-design.md)
- 방법: 로컬 E2E 백엔드(docker Postgres/Redis) + `.env.e2e` dev 서버 위에서 Playwright 터치
  에뮬레이션(iPhone SE / iPhone 14 / Pixel 7). "수정 전" 수치는 동일한 방법으로 측정한 값이다.

> Claude Chrome 확장은 이 세션에서 OAuth 계정 불일치로 연결되지 않아, 육안 확인은 헤드풀
> Chromium/WebKit 캡처로 대체했다. 동일하게 실제 브라우저 렌더링이다.

---

## FIX 1 — 시트 밖 입력 차단 (P0)

| 대상 | 수정 전 | 수정 후 |
|---|---|---|
| 평단 팝오버 수량 | `focused after tap: false`, 값 `""` | 값 `"12"` ✅ |
| 평단 팝오버 평단 | `focused after tap: false`, 값 `""` | 값 `"321.5"` ✅ |
| 헤더 종목 검색 | BLOCKED | `"TSLA"` ✅ |
| 챗봇 입력 | BLOCKED | `"안녕하세요"` ✅ (E2E 스펙) |
| `header` `aria-hidden` | `"true"` (앱 트리 전체) | `null` ✅ |
| 탭 직후 `activeElement` | `DIV#radix-*`(시트 컨테이너) | 팝오버 내부 입력 ✅ |

3개 기기(iPhone SE·iPhone 14·Pixel 7) 모두 동일.

**포커스 트랩 별도 확인** — 데스크탑(대조군)과 모바일 모두 열자마자 첫 입력에 포커스가
들어가고 Tab이 내부에 머문다.

```
DESKTOP @300ms active=INPUT#_r_8_-quantity insideDialog=true ; after Tab insideDialog=true
MOBILE  @300ms active=INPUT#_r_d_-quantity insideDialog=true ; after Tab insideDialog=true
```

> ⚠️ 측정 함정 기록: 모바일에는 `[role="dialog"]`가 **둘**(vaul 시트 + 포털된 팝오버) 존재한다.
> `querySelector('[role="dialog"]')`로 잡으면 시트가 먼저 걸려 "트랩이 죽었다"는 **오탐**이 난다.
> 반드시 `aria-labelledby`가 가리키는 제목으로 팝오버를 특정할 것.

## FIX 2 — 헤더 팝오버 오버플로우 + 시트에 가려짐

| 팝오버 | 수정 전 (iPhone SE / iPhone 14) | 수정 후 |
|---|---|---|
| 평단 설정 | x=**−88**..200 / **−18**..270, 둘 다 시트에 가려짐 | x=0..320 / 0..390, 화면 안 ✅ |
| 분석 설정(⚙) | 가로는 정상이나 둘 다 시트에 가려짐 | x=0..320 / 0..412, 화면 안 ✅ |

두 팝오버 모두 `portaledToBody=true`, `inHeader=false` — 헤더의 `relative z-40` 스택
컨텍스트를 탈출해 시트(z-50) 위에 합성된다.

## FIX 3 — 전일 요약 혼동

2일 전(2026-07-30) 스냅샷을 의도적으로 시드해, 고정 문구 "전일"이 거짓이 되는 상황을 만들었다.
SSR HTML 실측:

```
지난 AI 분석                              ← 배지
2026년 7월 30일 미국 장마감 기준            ← 실제 기준일 (고정 문구가 아님)
실시간 AI 분석 결과는 분석 패널에서 따로 제공됩니다.
전일 장마감 기준                           ← 0건 (더 이상 렌더되지 않음)
```

## FIX 4 — 초기 스냅이 차트를 덮음

| 기기 | 수정 전 시트 점유 | 수정 후 | 캔들 차트 | 거래량 차트 |
|---|---|---|---|---|
| iPhone SE | 0.52 | **0.12** | bottom 425 < sheetTop 500 ✅ | 456 < 500 ✅ |
| iPhone 14 | 0.52 | **0.12** | 480 < 584 ✅ | 527 < 584 ✅ |
| Pixel 7 | 0.52 | **0.12** | 591 < 738 ✅ | 676 < 738 ✅ |

"AI 분석 중…" 배너는 PEEK 가시 영역 안에 그대로 유지된다(육안 확인).

## CRITICAL 회귀 — 캐시 히트 렌더의 `RangeError`

`unstable_cache`가 JSON으로 왕복하므로 `generatedAt`이 캐시 히트 시 **문자열**로 돌아온다.
`Intl.DateTimeFormat.format()`에 넣으면 `RangeError: Invalid time value`가 **React 렌더 안**에서
터져 `getSeoSnapshotsStatic`의 try/catch로 잡히지 않는다. 경계에서 되살리도록 수정했고,
캐시를 비운 뒤 **미스 → 히트** 두 번 요청해 실증했다.

```
req1(MISS)=200  req2(HIT)=200
getSeoSnapshotsStatic 읽기 2회
RangeError / Invalid time value: 0건
```

---

## 캡처

`cap-desktop-popover` / `cap-desktop-snapshot` / `cap-mobile-initial` /
`cap-mobile-popover` / `cap-mobile-settings` / `cap-mobile-snapshot`

- 데스크탑: 평단 팝오버가 종전대로 칩에 앵커되어 열리고 입력 정상 — 동작 변화 없음.
- 모바일 초기: 차트·타임프레임 선택줄이 온전히 보이고 시트는 하단에서 "AI 분석 중" 배너 노출.
- 모바일 팝오버: 화면 중앙, 배경 딤 처리, 수량 입력에 포커스 링, 값 반영.
- 모바일 스냅샷 카드: "기술적 분석 요약" 옆에 `지난 AI 분석` 배지 + 실제 기준일 캡션.

## 자동 게이트

| 게이트 | 결과 |
|---|---|
| `yarn format:check` | 통과 |
| `yarn typecheck` | 통과 |
| `yarn lint` | 통과 |
| `yarn test` | **8999 통과** / 2 skipped |
| `yarn test-coverage` | statements 96.16% · branches 93.39% (임계값 90%) |
| `yarn build` | exit 0 |
| Playwright (모바일 도달성 + 회귀) | 26 통과 / 3 skipped / 0 실패 |
