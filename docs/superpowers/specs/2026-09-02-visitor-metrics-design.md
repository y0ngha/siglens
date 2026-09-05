# MAU/DAU 방문자 집계 설계

- 작성일: 2026-09-02
- 상태: 승인됨 (구현 전)
- 관련: `docs/superpowers/specs/2026-08-19-i18n-multilingual-design.md`(약관 번역 §2.5)

## 1. 목적

봇을 제외한 사람 방문자 기준으로 DAU(일 활성 사용자)와 MAU(월 활성 사용자)를
측정한다. 원본 IP는 저장하지 않는다.

부수적으로, 이 수집을 고지하기 위해 개인정보처리방침을 v2로 개정하면서
현재 인프라 스택과 어긋난 국외이전 고지를 함께 정정하고, 법률 문서(개인정보처리방침·
이용약관)의 비-한국어 번역 적재 경로를 신설한다.

## 2. 배경 — 기존 자산과 그 한계

| 자산 | 위치 | 이번 설계에서의 취급 |
|---|---|---|
| `isBot(headers)` | `src/shared/api/isBot.ts` | 그대로 재사용 |
| `getClientIp()` | `src/entities/chat-message/api/getClientIp.ts` | 그대로 재사용 |
| `hashUsageIp(ip, date)` | `@y0ngha/siglens-core` | **사용하지 않음** (사유는 §3.2) |
| `usage_logs` 테이블 | `src/shared/db/schema.ts` | **재사용하지 않음** (사유는 §3.1) |
| KST 날짜 조립 | `src/shared/lib/etTimeUtils.ts` 내부 인라인 | `kstDateKey()`로 추출해 재사용 |

### 2.1 `hashUsageIp`를 쓸 수 없는 이유

`hashUsageIp`는 salt에 UTC `YYYY-MM-DD`를 섞는다.

```
sha256(`${clientIp}:${utcDate}`)
```

같은 IP라도 매일 해시가 달라진다. 일일 rate limit에는 이 성질이 오히려
프라이버시상 이점이지만, **MAU는 원리적으로 불가능하다** — 한 사람이 30일
방문하면 30개의 서로 다른 해시가 되어 전부 다른 사람으로 집계된다.

### 2.2 `usage_logs`를 재사용할 수 없는 이유

`usage_logs`는 분석 요청 로그다. `actionType`·`modelUsed`가 `notNull`이라
방문 행을 넣으려면 의미 없는 값을 채워야 하고, `ipHash`가 §2.1의 일일 salt
해시라 MAU 축이 죽어 있다.

## 3. 데이터 모델

### 3.1 새 테이블 `visitor_days`

**방문자 1명당 하루 1행.**

```ts
export const visitorDays = pgTable(
    'visitor_days',
    {
        visitorHash: text('visitor_hash').notNull(),
        /** KST 기준 YYYY-MM-DD. 사유는 §3.3. */
        date: date('date').notNull(),
        firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    table => [primaryKey({ columns: [table.date, table.visitorHash] })]
);
```

복합 PK 하나가 세 가지를 동시에 한다.

1. 중복 방지 — `ON CONFLICT DO NOTHING`의 대상
2. DAU 조회 인덱스 — `WHERE date = $1`이 PK 접두사
3. MAU range 스캔 — `WHERE date >= $1`

별도 인덱스도, `id` 컬럼도 만들지 않는다.

`firstSeenAt`은 집계에 쓰이지 않는다. 그날 그 방문자의 **첫 접속 시각**을
남겨 두는 용도다 — 시간대별 트래픽 분포를 나중에 보고 싶을 때 이 컬럼이
없으면 소급이 불가능하다. 컬럼 하나 값이다.

### 3.2 방문자 해시

```
visitorHash = sha256(`${VISITOR_HASH_PEPPER}:${ip}:${userAgent}`)
```

- **pepper는 필수.** 없으면 throw한다. IPv4 공간은 2^32뿐이라 무염 SHA-256은
  전수 대입으로 즉시 역산된다 — 빈 문자열 폴백은 "해시했으니 안전하다"는
  거짓 안전감만 준다.
- **pepper는 고정.** 교체하면 그 시점에 MAU 연속성이 끊긴다.
- **User-Agent를 섞는 이유.** IP만 쓰면 통신사 NAT·CGNAT 뒤의 수백 명이
  1명으로 뭉쳐 과소집계된다. 반대급부로 한 사람이 폰과 PC를 쓰면 2명으로
  세어지지만, 모바일 비중이 큰 서비스에서는 NAT 뭉침 쪽이 훨씬 크다.

### 3.3 날짜는 KST

`hashUsageIp`의 UTC 관례를 따르지 않는다. UTC 자정은 KST 09:00이라 한국
사용자의 오전이 이틀로 쪼개진다.

`etTimeUtils.ts`의 `etToKst()` 안에 KST 날짜 조립 로직이 이미 인라인으로
있다. 이를 `kstDateKey(d: Date): string`로 추출하고 `etToKst`가 그것을 부르게
한다 — 새 파일을 만들지 않는다.

## 4. 수집 경로

### 4.1 왜 클라이언트 beacon인가

세 가지 후보를 검토했다.

| 후보 | 기각 사유 |
|---|---|
| 서버 컴포넌트에서 `headers()` | **ISR을 깨뜨린다.** 전 종목 페이지가 dynamic으로 내려가 CDN 히트율과 SEO 비용이 망가진다 |
| `proxy.ts`(edge middleware) | RSC prefetch·프리페치까지 전부 세서 사람 수가 심하게 부풀려진다. edge라 `node:crypto` 불가, 매 요청 DB 쓰기가 TTFB에 얹힌다 |
| **클라이언트 beacon** | 채택 |

클라이언트 beacon의 결정적 이점은 **봇 필터가 공짜**라는 점이다. JS를 실행하지
않는 크롤러는 beacon 자체를 띄우지 않는다. UA 정규식보다 훨씬 강력하다.

알려진 한계: 광고 차단기가 경로명을 보고 막을 수 있고(§4.3), JS를 끈 사용자는
누락된다. 둘 다 수용한다.

### 4.2 흐름

1. `src/app/[locale]/layout.tsx`가 client 컴포넌트 `<VisitorPing />`를 마운트
2. `localStorage`의 마지막 기록일이 오늘이면 종료. 아니면
   `fetch('/api/presence', { method: 'POST', keepalive: true })` — **본문 없음**
   (IP·UA는 헤더에 이미 있다)

   클라이언트도 **KST로 날짜를 판정한다**(`Intl.DateTimeFormat`에
   `timeZone: 'Asia/Seoul'`). 브라우저 로컬 타임존을 쓰면 서버의 날짜 경계와
   어긋나 그 방문자가 특정 날에 통째로 누락될 수 있다. 반대 방향(중복 POST)은
   서버가 `ON CONFLICT DO NOTHING`으로 흡수하므로 무해하다.
3. 라우트가 `isBot(headers)` → true면 204, 기록하지 않음
4. `process.env.NODE_ENV !== 'production'` → 204 (개발·프리뷰 트래픽 제외)
5. 해시 계산 후 `INSERT ... ON CONFLICT DO NOTHING`
6. 204 반환

### 4.3 경로명이 `/api/presence`인 이유

EasyList 계열 광고 차단 목록이 `analytics`·`track`·`collect`·`beacon`이 들어간
경로를 막는다. `presence`는 어느 목록에도 없다.

### 4.4 봇 필터 3중

| 층 | 걸러내는 것 |
|---|---|
| beacon이 JS 실행을 요구 | JS를 돌리지 않는 크롤러 전부 |
| 서버 `isBot(headers)` | JS를 돌리는 Googlebot 등 |
| `NODE_ENV` 게이트 | 개발·프리뷰·로컬 e2e 트래픽 |

## 5. 보존 기간 집행

개인정보처리방침에 400일이라 적으면 **실제로 지워야 한다.** 방침에 쓰고
삭제 로직이 없으면 그 자체가 방침 위반이다.

새 EventBridge cron(`infra/aws/15-*.sh` + AWS 프로비저닝)은 이 규모에 과하다.
`/api/presence`가 **인스턴스당 하루 1회** prune을 `after()`로 응답 뒤에 돌린다.

```ts
let lastPrunedDate: string | null = null; // 모듈 스코프

// 별도 cron 없이 보존 기간을 집행한다. DELETE는 멱등이라
// 인스턴스가 몇 개든, 같은 날 몇 번 돌든 무해하다.
if (lastPrunedDate !== today) {
    lastPrunedDate = today;
    after(() => db.delete(visitorDays).where(lt(visitorDays.date, cutoff)));
}
```

400일은 GA4 기본 보존 기간(14개월)과 같은 급이고, 전년 동월 MAU 비교가 가능한
최소 창이다.

트래픽이 0이면 prune도 돌지 않지만, 그 경우 지울 행도 없다.

## 6. 읽기 — `yarn metrics`

`scripts/metrics.ts`. 관리자 UI도 API 라우트도 만들지 않는다 —
`users`에 role 컬럼조차 없어 권한 체계부터 만들어야 한다.

```
날짜         DAU
2026-09-01   142
2026-08-31   118
...
MAU (30일 롤링): 1,847
총 행 수: 24,103
```

**MAU는 롤링 30일**이다(달력 월이 아니다). 달력 월 기준은 월초에 값이
1일치로 떨어져 추세를 못 읽는다. 달력 월 비교가 필요해지면 같은 테이블에
`WHERE date BETWEEN` 한 줄이면 되므로 지금 둘 다 만들지 않는다.

`총 행 수`를 같이 찍는 이유: 이 수가 눈에 띄게 커지면 그때 일별 집계
테이블을 도입하면 된다. 지금 만들면 YAGNI다.

## 7. 개인정보처리방침 v2

### 7.1 구조 — 방침은 DB에 있다

본문은 `terms` 테이블(`kind='privacy'`, `version` 별)에 있고
`db/seeds/terms/privacy/v1.md`에서 `yarn db:seed:terms`로 적재된다.
`findActive`가 `effective_date <= NOW()`인 것 중 가장 최근을 서빙한다.

### 7.2 본문 변경점

| 절 | 변경 |
|---|---|
| §2 수집 항목 | 비회원 자동수집에 항목 추가 — IP와 User-Agent를 결합한 SHA-256 가명 식별자와 접속 일자. 원본 IP 미저장, 다른 개인정보와 미결합 |
| §4 보유 기간 | "접속 통계: 수집일로부터 최대 400일" 추가 |
| §6 위탁·국외이전 | 현재 스택으로 교체 |

§6이 현재 사실과 어긋난다. 국외이전은 고지 의무 대상이라 방문자 통계 조항만
정확한 문서를 남길 수 없다.

| v1에 적힌 것 | 실제 |
|---|---|
| Vercel Inc. 호스팅 | Amazon Web Services(EC2·ALB) + Cloudflare, Inc. |
| Alpaca Securities LLC 시세 | Financial Modeling Prep, Yahoo Finance(yahoo-finance2) |
| — | DeepSeek 누락 |

Neon·Upstash·Google·Kakao·Anthropic·OpenAI는 유지한다. 방문자 해시가 Neon에
저장되므로 Neon 항목에 그 사실을 덧붙인다.

### 7.3 동의에는 영향이 없다

`agreements`는 가입 시점에만 기록되고 재동의 플로우가 없다. v2가 발효되면
신규 가입자에게만 v2의 `termsId`가 붙고 기존 회원은 v1 행을 유지한다.
개인정보처리방침 변경은 v1 §11대로 **고지** 대상이지 동의 대상이 아니므로
이것이 맞는 동작이다.

### 7.4 발효 시점 — 코드가 아니라 배포 순서로 푼다

v1 §11이 "변경 사항의 시행 전 고지"를 약속한다. 수집 항목 추가는 이용자에게
불리한 변경이라 사전 고지가 필요하다.

코드에 발효일 게이트를 넣으면 발효 후 죽은 코드가 된다. 순서로 푼다.

1. `notices` 테이블에 개정 예고 행 하나를 직접 입력 (코드 0줄)
2. 7일 뒤 배포. `v2.md`의 `effectiveDate`를 그 날짜로 지정

`findActive`가 `effective_date <= NOW()`로 거르므로 시드를 미리 적재해도
그날까지는 v1이 서빙된다. 배포는 한 번이면 된다.

## 8. 법률 문서 번역 적재 경로 (신설)

### 8.1 현재 상태

`content_translations`는 법률 문서 번역을 `source='human'`인 행만 신뢰한다
(오역이 곧 의무의 변경이라 AI 번역을 그대로 내보낼 수 없다). 그런데
`db/scripts/translateContentLocale.ts`는 약관을 의도적으로 배제하고, 다른
적재 경로가 **아예 없다.** 결과적으로 `/en/privacy`·`/ja/privacy`·`/zh/privacy`와
`/terms`의 비-ko 로케일이 전부 **한국어 본문 + "번역 없음" 배너** 상태다.

### 8.2 `seedTerms.ts` 확장

- frontmatter에 optional `locale` 필드 추가
  - 없거나 `ko` → `terms` 행 (base)
  - 있으면 → `content_translations` 행
    (`entity='terms'`, `field='body'`, `source='human'`)
- `validateSeedFiles`의 버전 연속성·중복 검사는 **base 시드에만** 적용
- base는 기존대로 `onConflictDoNothing` — 이미 발효된 본문을 조용히 바꾸면 안 된다.
  뒤집어 말하면 **한 번 적재한 `v2.md`는 파일을 고쳐도 DB에 반영되지 않는다.**
  본문 정정이 필요하면 v3를 발행한다
- 번역은 `onConflictDoUpdate` — 재실행하면 갱신된다
- 번역 upsert에 `terms.id`가 필요하므로 `upsertFromSeed`가 id를 반환하도록 변경

`locale`을 파일명이 아니라 frontmatter에서 읽는다. 파일명 파싱은 오타가 나면
그 파일이 조용히 무시되고 화면은 폴백 배너로 멀쩡해 보인다.

### 8.3 시드 파일

```
db/seeds/terms/privacy/v2.md          ko 신규 (§7.2)
db/seeds/terms/privacy/v2.en.md
db/seeds/terms/privacy/v2.ja.md
db/seeds/terms/privacy/v2.zh.md
db/seeds/terms/tos/v1.en.md
db/seeds/terms/tos/v1.ja.md
db/seeds/terms/tos/v1.zh.md
```

- privacy **v1의 번역은 만들지 않는다** — v2 발효 후 v1은 조회되지 않는다.
- tos는 업체를 언급하지 않아 정정할 것이 없다. **v2를 만들지 않고** v1 행에
  번역만 붙인다.
- `source='human'`은 "AI 파이프라인이 자동으로 채우지 않았다"는 뜻이다.
  번역문은 사용자 검수를 거친 뒤 적재한다.

## 9. 오류 처리

전부 사용자 경험에 영향 0으로 흡수한다. 방문 집계 실패가 페이지를 깨뜨리면
안 된다.

| 상황 | 처리 |
|---|---|
| DB 쓰기 실패 | `console.error` 후 204 |
| `localStorage` 접근 throw (Safari 프라이빗) | catch 후 그냥 매번 POST — 서버가 어차피 중복 제거 |
| `VISITOR_HASH_PEPPER` 누락 | **500 + `console.error`.** 이것만 예외다 — 조용히 0이 찍히는 것이 최악이라 프로덕션 로그에 남아야 한다. §3.2의 throw를 라우트가 잡지 않고 흘려보내면 Next가 500을 낸다. beacon은 fire-and-forget이라 사용자 화면에는 아무 영향이 없다 |
| prune DELETE 실패 | `console.error`. 다음 날 재시도된다 |

## 10. 테스트

| 대상 | 케이스 |
|---|---|
| `visitorHash` | 결정성 / 다른 pepper는 다른 해시 / pepper 누락 시 throw / 같은 IP·다른 UA는 다른 해시 |
| `kstDateKey` | UTC 14:59:59와 15:00:00이 다른 날짜 |
| `/api/presence` | 봇 UA면 미기록 / 정상 UA 기록 / 같은 방문자 2회 POST → 행 1개 / DB throw여도 204 / pepper 누락 시 500 |
| prune | 400일 초과 행만 삭제 / 같은 날 두 번째 요청은 재실행 안 함 |
| 리포지토리 | `getDau` 날짜 범위 / `getMau` distinct 집계 |
| `seedTerms` | `locale` frontmatter가 번역 행으로 / base만 버전 검증 / 번역 재실행 시 갱신 |
| 약관 렌더 | 4개 로케일 모두 `isTranslationFallback === false` |

## 11. 파일 목록

**방문자 집계**

```
src/shared/db/schema.ts                       visitorDays 테이블 추가
drizzle/00XX_*.sql                            yarn db:generate 산출물
src/shared/lib/etTimeUtils.ts                 kstDateKey 추출·export
src/entities/visitor/types.ts
src/entities/visitor/lib/visitorHash.ts       순수 함수
src/entities/visitor/api.ts                   server-only: recordVisit/prune/getDau/getMau
src/entities/visitor/index.ts                 barrel
src/features/visitor-ping/ui/VisitorPing.tsx  client
src/features/visitor-ping/index.ts
src/app/api/presence/route.ts
src/app/[locale]/layout.tsx                   VisitorPing 마운트
scripts/metrics.ts + package.json             yarn metrics
.env.example                                  VISITOR_HASH_PEPPER
```

**법률 문서**

```
db/scripts/seedTerms.ts                       locale frontmatter 지원
src/entities/terms/api.ts                     upsertFromSeed가 id 반환
db/seeds/terms/privacy/v2.md
db/seeds/terms/privacy/v2.{en,ja,zh}.md
db/seeds/terms/tos/v1.{en,ja,zh}.md
```

## 12. 의도적으로 뺀 것

| 뺀 것 | 사유 | 넣을 시점 |
|---|---|---|
| 일별 집계 테이블 | 행 하나가 ~90B. 현 트래픽에서 수년간 무해 | `yarn metrics`의 총 행 수가 수백만이 될 때 |
| 관리자 UI·API 라우트 | `users`에 role 컬럼조차 없어 권한 체계부터 필요 | 권한 체계를 별도로 만들 때 |
| 경로·리퍼러·로케일 기록 | 방문자당 하루 1행 구조와 충돌(첫 페이지만 남는다) | 유입 경로 분석은 별개 설계 |
| 신규 가입자 재동의 플로우 | 개인정보처리방침 변경은 고지 대상이지 동의 대상이 아니다 | 이용약관(tos)의 불리한 변경 시 |
| tos v2 | 정정할 사실 오류가 없다 | 약관 내용 자체가 바뀔 때 |

## 12.1 구현 분할

한 스펙이지만 두 축이 서로 독립적이라 PR을 나눌 수 있다.

1. **방문자 집계** (§3~§6, §9~§11) — 코드
2. **법률 문서** (§7~§8) — 시드·번역

순서는 2 → 1이어야 한다. §7.4대로 방침이 먼저 발효되어야 수집을 시작할 수
있다. 한 PR로 묶어도 §13의 배포 절차가 같은 순서를 강제하므로 결과는 같다.

## 13. 배포 절차

1. PR 병합
2. `notices` 테이블에 개정 예고 행 직접 입력 — 시행 7일 전
3. 프로덕션 SSM에 `VISITOR_HASH_PEPPER` 게시 (`infra/aws/04-params.sh`)
4. `yarn db:migrate` — `visitor_days` 테이블
5. `yarn db:seed:terms` — privacy v2 + 번역 7건
6. 시행일에 애플리케이션 배포
7. 다음 날 `yarn metrics`로 행이 실제로 쌓이는지 확인 — pepper 미설정이면
   여기서 0으로 드러난다

---

## 14. 진단 컬럼 추가 (2026-09-04)

### 14.1 계기

배포 후 실제 수치가 예상보다 많았다. §4.4의 봇 필터 3중이 정말 봇을 다 걸러내는지
확인할 방법이 없었다 — 통과한 트래픽의 원본 신호를 하나도 보관하지 않았기 때문이다.

원인 하나는 확정됐다. `isBot`이 얇았다. Next 내장 정규식(`Googlebot|Bingbot|
facebookexternalhit|Twitterbot|…|GPTBot`)에 `AI_BOT_RE` 6개 토큰을 더한 것이 전부라,
`robots.ts`가 이미 이름을 알고 있는 크롤러 대부분이 그냥 통과했다:

- AI: `PerplexityBot`, `Perplexity-User`, `ChatGPT-User`, `OAI-SearchBot`,
  `Bytespider`, `Amazonbot`, `CCBot`, `Meta-External*`, `anthropic-ai`,
  `Claude-Web`, `PetalBot`, `YouBot`, `Applebot`, `DuckAssistBot`
- 기생 SEO: `AhrefsBot`, `SemrushBot`, `MJ12bot`, `DotBot`, `BLEXBot`, `DataForSeoBot`
- 국내 검색: `Yeti`(네이버), `Daumoa`
- 비-브라우저 클라이언트: `curl/`, `python-requests`, `Go-http-client`,
  `HeadlessChrome`, `Chrome-Lighthouse`, 가동 감시 서비스

다만 이 부류는 상당수가 JS를 돌리지 않아 애초에 비콘을 띄우지 못한다. **남은
부풀림의 주범은 JS를 돌리는 봇**(headless 농장, AI 브라우저 에이전트)일 가능성이
크고, 그건 UA 목록으로는 영원히 잡히지 않는다. 그래서 원본 신호를 남긴다.

### 14.2 컬럼

| 컬럼 | 출처 | 왜 |
|---|---|---|
| `user_agent` | `user-agent` 헤더 원문 | 통과한 트래픽을 눈으로 검수. 토큰을 추가할 때 "며칠치가 얼마나 빠지는가"를 소급 확인 |
| `country` | `cf-ipcountry` | 봇 농장의 가장 값싼 신호 — 균일한 UA가 한 국가에서 몰리면 사람이 아니다 |
| `landing_path` | `referer`의 pathname | 진입 페이지 분포. 쿼리스트링은 버린다(검색어·토큰이 400일 테이블에 남는다) |

셋 다 nullable이고 **집계에 쓰이지 않는다.** 클라이언트 변경은 0 — 전부 이미 요청
헤더에 있다. `referer`는 비콘이 same-origin `fetch`라 현재 페이지 URL이 그대로 실린다.

읽기는 `yarn metrics`가 30일 상위 (UA, 국가) 표를 찍는다.

### 14.3 방침은 v2 수정이 아니라 v3 발행이다

§8.2가 명시한 대로 `upsertFromSeed`는 `onConflictDoNothing`이다. v2는 이미
프로덕션에 적재돼 있어(`effective_date = 2026-09-08 15:00+00` 실측 확인) **`v2.md`를
고쳐도 DB에 영원히 반영되지 않는다.** 번역 3종만 `upsertTranslation`의
`onConflictDoUpdate`로 갱신돼, 한국어 원문만 옛 문장으로 남는 최악의 형태가 된다.

→ `privacy v3` 발행. 발효일 **2026-09-19 00:00 KST**(v2 발효 9/9 + 10일).

### 14.4 발효 전 배포를 코드가 스스로 막는다

§7.4는 발효 시점을 "코드가 아니라 배포 순서로 푼다"고 했다. 이번엔 반대로 간다 —
`presence` 라우트가 `DIAGNOSTIC_COLUMNS_EFFECTIVE_AT`(v3 발효 시각)을 직접 보고,
그 전에는 세 컬럼을 `null`로 남긴다.

배포 순서에 기대면 순서를 한 번 어기는 것만으로 미고지 수집이 된다. 날짜 상수는
재배포 없이 발효 시각에 스스로 열린다. 방문 기록 자체는 종전대로 계속된다.

### 14.5 배포 절차 (§13 갱신분)

1. PR 병합
2. `yarn db:migrate` — `visitor_days`에 컬럼 3개 (`ALTER TABLE ADD COLUMN`, 무중단)
3. `yarn db:seed:terms` — privacy v3 + 번역 3건
4. 애플리케이션 배포 — **발효일 전에 배포해도 안전하다**(§14.4)
5. 2026-09-19 이후 `yarn metrics`로 UA 표 확인 → 크롤러가 보이면
   `src/shared/api/isBot.ts`에 토큰 추가
