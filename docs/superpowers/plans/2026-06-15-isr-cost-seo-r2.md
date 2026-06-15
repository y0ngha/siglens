# ISR 비용·SEO 최적화 R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봇 주도 ISR Write 비용을 줄이되 모든 종목의 검색 discoverability·SEO를 보존한다 — 롱테일 sitemap을 라우트 단위로 가지치기(#2), robots.txt AI봇 하이브리드 정책(#4), CF 주황구름+WAF 복구 런북 문서화(#3).

**Architecture:** #2·#4는 siglens 코드 변경(sitemap entry 빌더 + robots). #3은 코드가 아니라 사용자가 CF 대시보드에서 적용할 런북 문서. #1(overall seed quantize)은 측정으로 대상 없음이 확정되어 드롭. 스펙: `docs/superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md`.

**Tech Stack:** Next.js 16 (App Router, `MetadataRoute.Robots`), TypeScript, Vitest, FSD `entities/sitemap-entry`.

---

## File Structure

- `src/entities/sitemap-entry/lib/buildLongTailEntries.ts` — 롱테일 엔트리 빌더. 5라우트 → 메인 1라우트로 축소.
- `src/entities/sitemap-entry/model.ts` — `LONGTAIL_ENTRIES_PER_TICKER` 상수 5 → 1.
- `src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts` — 1라우트 단언으로 갱신.
- `src/app/api/sitemap/route.ts` — sitemap-index의 설명 주석 현행화(코드 동작 변경 없음).
- `src/app/robots.ts` — AI봇 Disallow/crawlDelay 그룹 추가.
- `src/app/__tests__/robots.test.ts` — AI봇 규칙 exact-array 단언 추가.
- `docs/architecture/CDN_CACHING.md` (신규) — CF 주황구름 재활성화 + WAF 런북(#3).

> **워크트리**: 코드 변경(Task 1·2)은 별도 git worktree에서 진행한다. node_modules는 `cp -al`(하드링크, symlink 금지) 후 잔여 `node_modules/node_modules` 제거. master의 core 버전과 워크트리 package.json 핀이 일치(둘 다 0.21.1)함을 확인했으므로 추가 install 불필요.

---

## Task 1: #2 — 롱테일 sitemap 라우트 가지치기 (5 → 1)

**Files:**
- Modify: `src/entities/sitemap-entry/model.ts` (LONGTAIL_ENTRIES_PER_TICKER)
- Modify: `src/entities/sitemap-entry/lib/buildLongTailEntries.ts`
- Modify: `src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`
- Modify: `src/app/api/sitemap/route.ts` (주석만)

- [ ] **Step 1: 테스트를 1라우트 기대로 먼저 수정 (failing)**

`src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`의 첫 두 테스트와 priority 테스트를 아래로 교체한다. `LONGTAIL_SUB_PRIORITY`·`LONGTAIL_LOW_PRIORITY` import는 더 이상 안 쓰므로 제거한다.

```typescript
vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import {
    buildLongTailEntries,
    LONGTAIL_CHART_PRIORITY,
} from '../lib/buildLongTailEntries';
import { LONGTAIL_ENTRIES_PER_TICKER } from '../model';

const BUILD_DATE = new Date('2026-01-15T00:00:00.000Z');

describe('buildLongTailEntries', () => {
    it('티커 1개 → 메인 차트 1개 엔트리만 반환한다(서브 라우트 미광고)', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER);
        expect(entries.map(e => e.url)).toEqual(['https://siglens.io/AAPL']);
    });

    it('여러 티커 → 티커당 1개씩 총 N개를 반환한다', () => {
        const entries = buildLongTailEntries(
            ['AAPL', 'MSFT', 'GOOG'],
            BUILD_DATE
        );
        expect(entries).toHaveLength(LONGTAIL_ENTRIES_PER_TICKER * 3);
        expect(entries.map(e => e.url)).toEqual([
            'https://siglens.io/AAPL',
            'https://siglens.io/MSFT',
            'https://siglens.io/GOOG',
        ]);
    });

    it('빈 배열 → 빈 배열을 반환한다', () => {
        const entries = buildLongTailEntries([], BUILD_DATE);
        expect(entries).toHaveLength(0);
    });

    it('메인 차트 엔트리는 priority 0.5 / weekly다', () => {
        const [chart] = buildLongTailEntries(['AAPL'], BUILD_DATE);
        expect(chart.url).toBe('https://siglens.io/AAPL');
        expect(chart.priority).toBe(LONGTAIL_CHART_PRIORITY);
        expect(chart.changeFrequency).toBe('weekly');
    });

    it('모든 엔트리의 lastModified는 전달받은 buildDate와 같다', () => {
        const entries = buildLongTailEntries(['AAPL'], BUILD_DATE);
        for (const entry of entries) {
            expect(entry.lastModified).toBe(BUILD_DATE);
        }
    });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `yarn test src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`
Expected: FAIL — 현재 빌더는 5엔트리를 반환하므로 길이/URL 단언 실패, 그리고 `LONGTAIL_ENTRIES_PER_TICKER`(=5)와도 불일치.

- [ ] **Step 3: model 상수를 1로 변경**

`src/entities/sitemap-entry/model.ts`의 `LONGTAIL_ENTRIES_PER_TICKER`를 5 → 1로 바꾸고, 인접 주석을 현행화한다.

```typescript
// 롱테일 종목은 메인 차트 라우트(/TICKER) 1개만 sitemap에 광고한다.
// 서브 라우트(overall/fundamental/news/fear-greed)는 thin/scaled-content 리스크와
// 봇 first-gen ISR write 비용을 줄이기 위해 미광고(페이지는 on-demand로 존재·내부 링크로 도달).
// LONGTAIL_TICKERS_PER_PAGE에서 역산하지 않는다(독립 상수).
export const LONGTAIL_ENTRIES_PER_TICKER = 1;
```

- [ ] **Step 4: 빌더를 메인 1라우트만 생성하도록 변경**

`src/entities/sitemap-entry/lib/buildLongTailEntries.ts` 전체를 아래로 교체한다. 미사용 상수(`LONGTAIL_SUB_PRIORITY`, `LONGTAIL_LOW_PRIORITY`)는 제거한다.

```typescript
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

export const LONGTAIL_CHART_PRIORITY = 0.5;

/**
 * long-tail 티커의 sitemap 엔트리를 생성한다.
 *
 * 메인 차트 라우트(/TICKER) 1개만 광고한다 — 모든 종목이 검색 색인되도록 discoverability는
 * 보존하되, 서브 라우트(overall/fundamental/news/fear-greed)는 미광고해 봇 first-gen ISR write
 * 비용과 thin/scaled-content 색인 리스크를 줄인다. 서브 라우트는 on-demand ISR로 계속 존재하고
 * 내부 링크(CrossLinkCards)로 도달 가능하다. popular 종목은 buildPopularEntries가 풀 라우트로 다룬다.
 * popular과 동일하게 옵션 라우트 제외, 낮은 priority, 고정 lastmod(SITE_BUILD_DATE).
 */
export function buildLongTailEntries(
    tickers: readonly string[],
    buildDate: Date
): SitemapEntry[] {
    return tickers.map(
        (ticker): SitemapEntry => ({
            url: `${SITE_URL}/${ticker}`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: LONGTAIL_CHART_PRIORITY,
        })
    );
}
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run: `yarn test src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts`
Expected: PASS (5 테스트 모두 통과).

- [ ] **Step 6: 의존 상수 미사용·참조 깨짐 점검 + sitemap-index 주석 현행화**

Run: `grep -rn "LONGTAIL_SUB_PRIORITY\|LONGTAIL_LOW_PRIORITY" src/`
Expected: 매치 없음(빌더·테스트에서 모두 제거됨). 매치가 남으면 해당 참조를 정리한다.

`src/app/api/sitemap/route.ts`의 구성 설명 주석에서 long-tail 라우트 설명을 현행화한다:
```
 *   - /sitemap-longtail-{n}.xml : long-tail 종목당 메인 차트(/TICKER) 1 URL, page당 LONGTAIL_TICKERS_PER_PAGE tickers
```
(코드 로직은 불변 — `LONGTAIL_TICKERS_PER_PAGE`=2000 유지, 1 URL/티커라 파일당 2000 URL로 50k 한도 내.)

- [ ] **Step 7: 인접 테스트 회귀 확인**

Run: `yarn test src/entities/sitemap-entry src/app/api/sitemap`
Expected: PASS. `buildPopularEntries.test.ts`(불변), `route.test.ts`/`longtail.test.ts`(pagination은 티커 수 기반이라 영향 없음)가 모두 통과해야 한다. 실패 시 해당 테스트가 5엔트리를 가정하는지 확인하고, 가정이 있으면 1엔트리로 갱신한다.

- [ ] **Step 8: 변경 스테이징 (커밋은 git-agent가 최종 수행)**

```bash
git add src/entities/sitemap-entry/model.ts src/entities/sitemap-entry/lib/buildLongTailEntries.ts src/entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts src/app/api/sitemap/route.ts
```

---

## Task 2: #4 — robots.txt AI봇 하이브리드 정책

**Files:**
- Modify: `src/app/robots.ts`
- Modify: `src/app/__tests__/robots.test.ts`

- [ ] **Step 1: 실패 테스트 추가 (failing)**

`src/app/__tests__/robots.test.ts`에 아래 테스트를 추가한다(기존 테스트는 유지).

```typescript
it('AI 학습/스크레이퍼 크롤러를 전면 Disallow한다', () => {
    const result = robots();
    expect(result.rules).toContainEqual(
        expect.objectContaining({
            userAgent: [
                'GPTBot',
                'Google-Extended',
                'Applebot-Extended',
                'Bytespider',
                'CCBot',
                'Meta-ExternalAgent',
                'Amazonbot',
                'anthropic-ai',
                'cohere-ai',
                'Diffbot',
                'Omgilibot',
                'ImagesiftBot',
            ],
            disallow: '/',
        })
    );
});

it('AI 검색·인용 크롤러는 crawlDelay로 허용(접근 보존)한다', () => {
    const result = robots();
    expect(result.rules).toContainEqual({
        userAgent: ['PerplexityBot', 'OAI-SearchBot'],
        allow: '/',
        crawlDelay: 60,
    });
});

it('검색 색인 핵심 봇(Googlebot 계열·Yeti·Bingbot·Daumoa)은 어떤 Disallow 그룹에도 없다', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const fullyDisallowed = rules
        .filter(rule => rule.disallow === '/')
        .flatMap(rule =>
            Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]
        );
    for (const bot of [
        'Googlebot',
        'Googlebot-Image',
        'Googlebot-News',
        'Yeti',
        'Bingbot',
        'Daumoa',
    ]) {
        expect(fullyDisallowed).not.toContain(bot);
    }
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `yarn test src/app/__tests__/robots.test.ts`
Expected: FAIL — 새 AI봇 그룹이 아직 robots()에 없어 처음 두 테스트 실패.

- [ ] **Step 3: robots.ts에 AI봇 그룹 추가**

`src/app/robots.ts`의 상수 블록에 두 그룹을 추가한다(기존 상수 아래).

```typescript
// AI 학습/콘텐츠 스크레이퍼 크롤러. 검색 색인에 기여하지 않으면서 종목 페이지 전수를 크롤해
// 봇 first-gen ISR write 비용만 유발하므로 전면 Disallow한다. ⚠️ Google-Extended는 Gemini/Vertex
// '학습' opt-out 토큰으로 검색 색인(Googlebot)과 무관 — GoogleOther 계열과 혼동 금지.
// 검색 색인 봇(Googlebot/Yeti/Bingbot/Daumoa)은 절대 포함하지 않는다.
const AI_TRAINING_CRAWLER_USER_AGENTS = [
    'GPTBot',
    'Google-Extended',
    'Applebot-Extended',
    'Bytespider',
    'CCBot',
    'Meta-ExternalAgent',
    'Amazonbot',
    'anthropic-ai',
    'cohere-ai',
    'Diffbot',
    'Omgilibot',
    'ImagesiftBot',
];

// AI 검색·인용 크롤러. ChatGPT/Perplexity 검색의 인용 가시성을 보존하기 위해 차단 대신
// crawlDelay로 빈도만 낮춘다(ClaudeBot과 동일 정책).
const AI_SEARCH_CRAWLER_USER_AGENTS = ['PerplexityBot', 'OAI-SearchBot'];
```

이어서 `robots()`의 `rules` 배열에 두 규칙을 추가한다(기존 규칙 뒤, `sitemap` 앞).

```typescript
            {
                userAgent: AI_TRAINING_CRAWLER_USER_AGENTS,
                disallow: '/',
            },
            {
                userAgent: AI_SEARCH_CRAWLER_USER_AGENTS,
                allow: '/',
                crawlDelay: ANTHROPIC_CRAWL_DELAY_SECONDS,
            },
```

> `ANTHROPIC_CRAWL_DELAY_SECONDS`(=60)를 재사용한다 — AI 크롤러 공통 60s 지연.

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `yarn test src/app/__tests__/robots.test.ts`
Expected: PASS (기존 + 신규 테스트 전부).

- [ ] **Step 5: 변경 스테이징**

```bash
git add src/app/robots.ts src/app/__tests__/robots.test.ts
```

---

## Task 3: #3 — CF 주황구름 재활성화 + WAF 복구 런북 (문서)

**Files:**
- Create: `docs/architecture/CDN_CACHING.md`

> 코드 변경 없음. 사용자가 CF 대시보드에서 적용할 정확한 런북을 문서화한다(Claude는 CF 계정 로그인·설정 변경 불가).

- [ ] **Step 1: 런북 문서 작성**

`docs/architecture/CDN_CACHING.md`를 아래 내용으로 생성한다.

````markdown
# CDN(Cloudflare) 캐싱·봇 보호 런북

> 적용 주체: 사용자(CF 대시보드). 설계 근거: [`docs/superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md`](../superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md).
> 관련 메모리: `project_cloudflare_vercel_infra`.

## 0. 현재 상태 (2026-06-15 실측)

siglens.io는 **grey-cloud(DNS only)** — CF 프록시 OFF. 헤더에 `server: Vercel`·`cf-ray` 없음, A 레코드가 Vercel IP 직결(네임서버는 CF). 6/6엔 주황구름 + WAF 봇 차단이 활성이었다. 그 사이 OFF로 바뀌어 WAF·봇 차단이 비활성 → 봇이 Vercel 직격 → ISR Write 비용 증가.

## 1. 사전 점검 (전환 전 필수)

1. grey-cloud가 의도였는지 확인(SSL/리다이렉트 루프 회피 목적이었을 수 있음).
2. CF SSL/TLS 모드를 **Full (Strict)** 로 설정(Vercel은 유효 인증서 제공; `Flexible`은 루프·혼합콘텐츠 유발).
3. A/CNAME 레코드를 **주황구름(프록시 ON)** 으로 토글.
4. `/`·`/AAPL`·`/AAPL/overall`에서 **리다이렉트 루프·SSL 오류 없음 + `cf-ray` 헤더 출현**을 실측 검증.

## 2. WAF 룰 (무료 플랜: custom 5개 한도 중 3개 사용)

| # | 이름 | 표현식 | 액션 |
|---|---|---|---|
| R1 | Block scanner paths | `http.request.uri.path contains ".php" or http.request.uri.path contains "/wp-" or http.request.uri.path contains "/.env" or http.request.uri.path contains "/.git"` | Block |
| R2 | Block abusive ASN | `ip.geoip.asnum in {132203 13220}` | Block |
| R3 | Challenge non-KR 비검증 봇 | `(ip.geoip.country ne "KR") and (not cf.client.bot) and (not lower(http.user_agent) contains "yeti") and (not lower(http.user_agent) contains "daum") and (not lower(http.user_agent) contains "claudebot") and (not lower(http.user_agent) contains "claude-searchbot") and (not lower(http.user_agent) contains "perplexitybot") and (not lower(http.user_agent) contains "oai-searchbot")` | Managed Challenge |

- **R3가 핵심 레버**: 검증 검색봇(`cf.client.bot`=Googlebot/Bingbot)·한국 검색봇(Yeti/Daum)·살린 AI봇(Claude/Perplexity/OAI)은 통과, 나머지 non-KR 비검증 봇은 Managed Challenge → JS 못 풀어 렌더 불가 → first-gen ISR write 0. robots.txt를 무시하는 봇을 잡는 catch-all.
- **6/6 대비 차이**: R2에서 ClaudeBot AWS 범위(216.73.216.0/24) 제외(하드 Block 해제됨, robots crawlDelay로 완화). R3에 Claude/Perplexity/OAI UA 예외(접근 유지).
- ⚠️ **적용 시 CF Security Analytics(24h)로 top-offender IP/ASN 재확인** 후 R2의 ASN 현행화(132203·13220은 6/6 식별값).

## 3. HTML Cache Rule — 보류

App Router는 같은 URL에서 완전 HTML과 RSC 페이로드를 요청 헤더(`RSC` 등)로 분기 응답하며 `Vary: rsc, next-router-*`를 보낸다. CF는 기본적으로 `Accept-Encoding` 외 Vary를 캐싱에 반영하지 않아, 순진한 "Cache Everything"은 한 변형을 모두에게 제공해 **페이지가 깨질 수 있다**. 안전하게 하려면 `RSC` 헤더 부재 시(완전 HTML)만 캐싱하도록 cache-key/eligibility 커스터마이즈가 필요한데 무료 플랜에선 제한적이다. 비용 직격은 R3(WAF)가 수행하므로 **WAF 효과 측정 후 별도 후속**으로 정밀 설계한다.

## 4. 검증

- 전환 직후: `cf-ray` 출현 + 루프/SSL 무오류.
- 며칠 뒤: **Vercel ISR Write 일별 추세 하락** + CF Security Analytics에서 R3 Challenge 이벤트 증가.
````

- [ ] **Step 2: 문서 링크 무결성 확인**

Run: `test -f docs/superpowers/specs/2026-06-15-isr-cost-seo-r2-design.md && echo OK`
Expected: `OK` (런북이 참조하는 스펙 경로 존재).

- [ ] **Step 3: 변경 스테이징**

```bash
git add docs/architecture/CDN_CACHING.md
```

---

## 최종 검증 & 핸드오프

- [ ] **전체 스위트 + 빌드**

Run: `yarn test src/entities/sitemap-entry src/app` 그리고 `yarn lint`
Expected: PASS. (sitemap·robots 관련 전 테스트 + 린트 통과.)

- [ ] **에이전트 플로우로 마감 (repo CLAUDE.md 규약)**

orchestrator는 직접 커밋하지 않는다. 구현 완료 후:
1. `review-agent` 호출 → findings 수정 → approved까지 반복.
2. `mistake-managing-agent` 호출.
3. `git-agent` 호출 → 워크트리 변경 커밋 + PR 생성(스펙·플랜·코드·런북 문서 포함). 브랜치명 예: `perf/isr-cost-seo-r2-sitemap-robots`.

> **#3(CF 적용)은 PR과 별개**다. PR 머지·배포 후 사용자가 `docs/architecture/CDN_CACHING.md` 런북에 따라 CF 대시보드에서 직접 적용하고 §4로 검증한다.

---

## Self-Review

**1. Spec coverage:**
- #1 드롭 → 비목표로 명시(코드 작업 없음). ✓
- #2 롱테일 라우트 가지치기 → Task 1. ✓
- #3 CF/WAF 런북 → Task 3(문서). ✓
- #4 robots AI봇 하이브리드 → Task 2. ✓
- discoverability 보존(메인 라우트 유지) → Task 1 빌더가 `/TICKER` 1개 유지. ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 코드 스텝에 실제 코드 포함. R2 ASN은 "적용 시 현행화" 단서(런북·스펙 일관). ✓

**3. Type consistency:** `LONGTAIL_ENTRIES_PER_TICKER`(model) 1로 통일 — 빌더·테스트 일치. `LONGTAIL_CHART_PRIORITY` 유지, `LONGTAIL_SUB_PRIORITY`·`LONGTAIL_LOW_PRIORITY` 제거(빌더·테스트·grep 점검 일관). robots 그룹명(`AI_TRAINING_CRAWLER_USER_AGENTS`·`AI_SEARCH_CRAWLER_USER_AGENTS`)·`ANTHROPIC_CRAWL_DELAY_SECONDS` 재사용 일관. `SitemapEntry` 필드(url/lastModified/changeFrequency/priority) 실제 타입과 일치. ✓
