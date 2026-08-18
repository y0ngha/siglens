# kr-equity 감사 수정 — 변경 스코프와 테스트 케이스

**작성일**: 2026-08-18
**상태**: 배포 대기
**범위**: `origin/master`(v0.55.0) → `audit/kr-release`. siglens-core 변경 없음.
**선행 문서**: [`2026-08-16-kr-equity-design.md`](2026-08-16-kr-equity-design.md)

---

## 0. 이 문서가 다루는 것

한국 주식 지원(v0.55.0)이 나간 뒤 **5종 감사 루프**를 findings가 0이 될 때까지
돌려 나온 수정들이다. 기능 추가가 아니라 전부 결함 수정·커버리지 보강이므로,
설계 문서는 위 선행 문서 그대로이고 여기서는 **무엇이 왜 틀렸었는지**와
**무엇이 그걸 다시 잡아주는지**만 기록한다.

감사 라운드 구성:

| 라운드 | 투입 | findings |
|---|---|---|
| 1~3 | 5종(코드·SEO·테스트·배포영향·비용) | 다수 — 각 라운드 수정 후 재투입 |
| 4 | 코드·SEO·배포영향 | 코드/SEO 다수, 배포영향 0 → 이후 제외 |
| 5 | 코드·SEO | 코드 5, SEO 0 → SEO 제외 |
| 6 | 코드 | (수렴 확인) |

규칙: **직전 라운드에서 0을 낸 에이전트는 다음 라운드에서 빠진다.** 남은 전원이
0을 낼 때까지 반복한다.

---

## 1. 변경 스코프

`origin/master...HEAD` 기준 123파일, +4,757/−549. 커밋 13개.

### 1.1 시장 캘린더·세션

| 커밋 | 내용 |
|---|---|
| `5f4c536b` | KRX 휴장일 리터럴 캘린더 도입 — `MarketSessionSpec.closeMinuteFor`로 주입. `0`이면 휴장 |
| `44fc4b15` | `KR_CALENDAR_HORIZON`을 릴리스 당일 → `2026-12-31`로 연장, 고시 휴장일 7일 추가 |

**왜 결함이었나**: 지평선이 릴리스 당일이면 다음 날부터 전 날짜가 폴백을 타
정상 개장으로 취급된다 — 수정 전과 동작이 같다. 첫 회귀는 추석이고 KR URL
100개가 같은 `lastmod` 과대 표기를 되풀이한다.

관측(yahoo 일봉 차집합)과 고시(공표 일정)를 주석에서 구분해 표기한다.
`2026-07-17`이 관측 목록에 있는 것은 제헌절이 그해 공휴일로 부활했기 때문이며
오기가 아니다.

### 1.2 SEO 표면

| 커밋 | 내용 |
|---|---|
| `635ee11f` | SEO 감사 5건 + 옵션 없는 시장에 옵션을 말하던 호출부 3곳 |
| `02c5e069` | 잘못 라벨된 티커 2종 제거, 홈 타이틀 폭, `/market` 색인성 |
| `44fc4b15` | `/[symbol]/overall` degrade 게이트 |

`/overall`만 형제 라우트와 달리 본문이 placeholder로 떨어져도 `index,follow` +
self-canonical을 내보내고 있었다. sitemap priority가 0.85로 가장 높은 계열이다.
게이트 조건은 `degraded` 플래그가 아니라 **본문이 실제로 placeholder로 떨어지는
조건**(프로즈 없음 AND peek 캐시 없음)이며, 본문 렌더와 같은 키·인자를 쓰므로
캐시 히트다.

영향 범위 실측: overall 스냅샷 보유 심볼 287개 중 KR은 0개. 스냅샷은 Postgres에
있어 배포로 사라지지 않으므로 미국·크립토는 cold ISR에서도 색인 상태를 유지한다.

### 1.3 prewarm·크론

| 커밋 | 내용 |
|---|---|
| `fe03ed30` | 회전이 KR 상위 5종목을 영구 기아시키던 문제 |
| `40e30969` | 장중 defer **배선** 회귀 가드 + 아웃바운드 타임아웃 |

`shouldDeferPrewarmWhileOpen` 헬퍼 자체는 유닛 테스트가 있었지만
`runPrewarmBatch`에서 `selectable`을 거르는 **호출**은 필터를 통째로 지워도
해당 디렉터리 100건이 전부 통과했다. 프로브로 확인한 결과 전 스위트에서 이
필터가 심볼을 빼는 틱이 0회다.

### 1.4 종목 마스터·상장 상태

| 커밋 | 내용 |
|---|---|
| `c9ca5ff5`(v0.55.0) | `delisted_at` 스키마(drizzle 0028) + 일 1회 동기화 |
| `2212d9f5`·`924897fd`·`af43287e`·`cea6b582` | 캐시 가림, 한글 placeholder 되돌림, 배치 분할, 리컨사일 범위 |
| `40e30969` | 큐레이션 한글명 fallback 테스트 + `persistTranslation` 캐시 결손 |

`persistTranslation`이 캐시 payload를 필드 단위로 재조립해 `marketProfile`이
빠진 채 1년 TTL로 굳고 있었다. 현재는 `marketProfileOf`의 심볼 형상 폴백이
한국 종목을 되살려 증상이 없고, 형상으로 판정 못 하는 프로필(크립토)은 이
경로를 타지 않는다. 호출부가 돌려준 객체를 그대로 굳히도록 바꿨다.

### 1.5 통화·표기

| 커밋 | 내용 |
|---|---|
| `bb423cfb` | 통화 판정을 `marketProfile` 레지스트리로 단일화 |
| `fb34c2c2`·`9861cb70`·`74f67d08` | 포지션·포트폴리오·차트 탭 원화 표기 + 배선 6곳 고정 |
| `5f4c536b` | 시장별 장마감 캡션(`formatSnapshotAsOf(date, marketProfile)`) |

말단(`priceFormat`)과 최상위(페이지)만 테스트가 지키고 **사이 배선이 비어**
있었다. 6곳을 고정했다.

### 1.6 자산 분류

| 커밋 | 내용 |
|---|---|
| `400995b3` | KR ETF 오분류 |
| `6f62ccf8` | 펀드명 안전망이 미국 리츠의 `Corporation` 노드를 지우던 회귀 |
| `40e30969` | 끝-토큰 불변식 회귀 가드 복원 |

`FUND_NAME_SUFFIX_WORDS`에서 `TRUST`를 뺐다 — 미국 리츠(`Vornado Realty Trust`)와
진짜 펀드(`SPDR Gold Trust`)를 이름만으로 가를 수 없어, 두 오류 중 조용한 쪽을
피한다. 그 결과 `Northern Trust Corporation`을 쓰던 "끝 토큰만 본다" 회귀 가드가
빈 껍데기가 됐고, 실제 원소를 중간 토큰으로 가진 이름(`Global Index Partners
Corporation`)으로 교체했다.

### 1.7 테스트 품질

| 커밋 | 내용 |
|---|---|
| `8e419487`·`fe39705f`·`df8b7697` | 코드를 깨도 통과하던 테스트 13종 + 항진명제 E2E 3건 |
| `c1101d53`·`c752162a` | 순수 함수 전용 테스트, 상수 교차 참조 |

---

## 2. 자동 테스트 인벤토리

pending diff에 포함된 테스트 파일 60개. 판정 기준은 커버리지 %가 아니라
**뮤테이션**이다 — 구현을 깨서 정확히 그 테스트가 실패해야 통과로 친다.

| 영역 | 대표 파일 | 고정하는 불변식 |
|---|---|---|
| KRX 캘린더 | `shared/api/market/__tests__/sessionSpecFor.test.ts` | 휴장일 = `0` 반환, 지평선 밖 = 정상 개장 폴백 + 날짜당 1회 경고 |
| 세션 날짜 | `shared/lib/__tests__/marketSessionDate.test.ts` | 주말·KRX 휴장일 되감기 |
| 마감 캡션 | `shared/lib/__tests__/formatSnapshotAsOf.test.ts` | 프로필별 타임존·라벨 |
| 통화 | `shared/lib/__tests__/priceFormat.currency.test.ts`, `widgets/financials/__tests__/*.currency.test.tsx`, `features/portfolio-holding/__tests__/PortfolioChip.test.tsx` | KR = KRW, 배선 6곳 |
| 자산 분류 | `entities/ticker/__tests__/lib/assetClassification.test.ts` | 끝 토큰만 판정, 리츠 보존, KR ETF |
| 종목 마스터 | `entities/ticker/__tests__/api.test.ts`, `shared/api/dataGoKr/__tests__/toKoreanTickerRows.test.ts` | 상폐·재상장 배치, 큐레이션 한글명 우선 |
| asset info | `entities/ticker/__tests__/lib/getAssetInfo.test.ts` | 큐레이션 fallback, 캐시 레코드 = 반환 객체 |
| prewarm | `app/api/cron/seo-prewarm/__tests__/runPrewarmBatch.test.ts` | 회전 커버리지, **장중 defer 배선**, staleTotal 의미 |
| 크론 | `app/api/cron/kr-tickers/__tests__/route.test.ts` | 202 + `after()` 위임 |
| sitemap | `entities/sitemap-entry/__tests__/buildPopularEntries*.test.ts` | KR 6탭 스코프, options/congress 제외, lastmod |
| 메타데이터 | `app/[symbol]/__tests__/symbol-metadata.test.ts`, `app/[symbol]/overall/__tests__/page.test.ts` | canonical 정규화, degrade 시 noindex |
| 스냅샷 프로즈 | `views/symbol/snapshot/__tests__/*SnapshotProse.test.tsx` | 7종 전부 `marketProfile` 필수 |
| E2E | `e2e/specs/kr-equity-seo.spec.ts` | 항진명제 제거 후의 실제 계약 |

---

## 3. 배포 후 프로덕션 실증 (curl)

지금까지의 검증은 **전부 localhost**였다. 배포 후 아래를 프로덕션에서 확인한다.
브라우저 실증은 이번 범위에서 제외.

| # | 확인 | 방법 | 기대 |
|---|---|---|---|
| 1 | 종목 페이지 렌더 | `curl -s https://siglens.io/005930.KS \| grep -o '삼성전자'` | 한글명 노출 |
| 2 | 원화 표기 | 같은 응답에서 `₩` 또는 `KRW` | USD 없음 |
| 3 | 한글 검색 | 검색 API에 `삼성전자` 질의 | `005930.KS` 반환 |
| 4 | 뉴스 탭 | `curl -s https://siglens.io/005930.KS/news` | 실제 기사 제목(런타임 키 주입 확인) |
| 5 | 소문자 정규화 | `curl -sI https://siglens.io/005930.ks` | 301 → 대문자 |
| 6 | sitemap lastmod | KR 엔트리의 `lastmod` | 직전 **개장일** 마감 시각. 휴장일 아님 |
| 7 | sitemap 스코프 | KR 심볼의 URL 집합 | 6탭만. `/options`·`/congress` 없음 |
| 8 | robots | `curl -s https://siglens.io/robots.txt` | KR sitemap과 무모순 |
| 9 | `/overall` 색인성 | KR 심볼 `/overall`의 `<meta name="robots">` | 프로즈 채워지기 전에는 `noindex` |
| 10 | 미국 종목 무영향 | `AAPL`의 `/overall` | `noindex` 아님 |
| 11 | kr-tickers 크론 | `curl -i -X PATCH https://siglens.io/api/cron/kr-tickers -H "Authorization: Bearer $CRON_SECRET"` | 202. 헤더 없으면 401이 정상 |

6·9는 시각 의존이므로 **KRX 마감 이후** 확인한다.

---

## 3.5 릴리스 절차 (버전 재사용 금지)

`package.json`은 `0.55.0`이고 `v0.55.0` 태그는 **이미 존재한다**. 태그를 옮겨
재사용하면 안 된다 — `GIT_SHA`가 S3 ISR 캐시의 프리픽스이므로
(`cache-handler/config.mjs`의 `buildId`, `s3Store.mjs`의 키 조립), 같은 버전을
다시 쓰면 새 코드가 **이전 릴리스가 채워 둔 캐시를 읽는다**. 알람도 로그도 없이
옛 HTML이 나간다. ECR 저장소도 MUTABLE이라 이미지까지 덮어쓴다.

버전 bump는 이 브랜치에서 하지 않는다. `release-it`이 master에서
(`requireBranch: master`) bump·CHANGELOG·커밋·태그·push를 한 번에 처리하므로,
PR에서 미리 올리면 릴리스가 그 값을 기준으로 한 단계 더 올라간다.

절차: 병합 후 master에서 `yarn release:minor` → `0.56.0` + `v0.56.0` 태그가
**git push**로 나가고 `deploy.yml`이 돈다(GitHub API로 만든 ref는 push 이벤트가
없어 배포가 조용히 안 돈다). 확인: `gh run list --workflow=deploy.yml`.

마이그레이션 `0028`은 **이미지 빌드 전에** 적용한다 — `deploy.yml`이 빌드 시점에
프로덕션 `DATABASE_URL`을 주입해 ISR을 prerender하므로, 순서가 뒤바뀌면 degrade된
페이지가 이미지에 구워진다. 추가 컬럼(nullable) + 인덱스라 현행 v0.55.0에 무해하다.

## 4. 수동 작업 (배포와 별개)

`infra/aws/` 스크립트 2종은 AWS 자격증명이 필요해 이번 세션에서 실행하지 못했다.
`siglens-deployer` 프로파일은 `events:*`/`iam:*`가 거부돼 우회 경로가 없다.

1. `bash infra/aws/13-seo-prewarm.sh` — 크론 창(20:30–03:59 / 07:00–09:55 UTC)
   **밖에서** 실행. 재실행이 비활성 룰을 조용히 다시 켜므로 실행 후 상태 확인 필요.
2. **배포 후** `bash infra/aws/14-kr-tickers-cron.sh` →
   `curl -i -X PATCH https://siglens.io/api/cron/kr-tickers -H "Authorization: Bearer $CRON_SECRET"`
   (202 기대 — 이 라우트는 Bearer 게이트라 헤더 없이 부르면 401이다.
   `docs/reference/CRON.md` §kr-tickers와 같은 형태) → 알람 존재 확인.

---

## 5. 알려진 잔여

- `notFound()`가 Suspense 안에서는 200을 반환한다 — 기존 문서화된 잔여. 이번 범위 아님.
- KR `/overall` 20개가 sitemap priority 0.85에 있으면서 프로즈가 채워질 때까지
  noindex다. `13-seo-prewarm.sh`의 `kr-boundary` 룰이 그 스냅샷을 채우는 장치이며,
  수렴은 전 탭이 fresh가 될 때만 `revalidateTag`가 발화하므로 최대 페이지
  `revalidate` 주기만큼 늦을 수 있다.
