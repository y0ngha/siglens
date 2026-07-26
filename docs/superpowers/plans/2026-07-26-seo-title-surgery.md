# SEO title 수술 (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 12개 심볼 SEO title 템플릿에 한국어 회사명을 넣고 `| Siglens` 접미사를 제거해, 한국어 검색어(`엔비디아 주가`)와의 매칭을 만든다.

**Architecture:** 변경은 `src/shared/lib/seo.ts` 한 파일에 집중된다. 12개 빌더가 모두 `BuildSymbolSeoOptions`(`koreanName` 포함)를 받으므로 호출부 시그니처 변경이 전혀 없다. 폭 가드(`clampSeoTitle`)를 안전망으로 두고, 접미사 제거는 `symbolMetadataFromSeo`가 `title: { absolute }`를 반환하는 것으로 처리한다.

**Tech Stack:** TypeScript, Next.js 16 Metadata API, vitest

**Spec:** `docs/superpowers/specs/2026-07-26-seo-title-and-fear-greed-hub-design.md`

**Deploy note:** 이 계획은 **단독 PR·단독 배포**다. Part B(fear-greed 허브)와 절대 함께 배포하지 않는다. 인과를 분리해 2~3주간 GSC 평균 게재순위(기준선 18.7)를 관측해야 한다.

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `src/shared/lib/seo.ts` | title 주어 생성, 폭 계산·클램프, 12개 템플릿, 메타데이터 조립 | 수정 |
| `src/shared/lib/__tests__/seo.titleWidth.test.ts` | 폭 계산·클램프 단위 테스트 | 신규 |
| `src/shared/lib/__tests__/seo.titleSubject.test.ts` | 주어 생성 + 12개 템플릿 폭·degrade 테스트 | 신규 |
| `src/shared/lib/__tests__/seo.test.ts` | 기존 title 단언 갱신 | 수정 |
| `src/shared/lib/__tests__/seo.crypto.test.ts` | 기존 크립토 title 단언 갱신 | 수정 |

새 테스트를 두 파일로 나누는 이유: 폭 계산은 순수 문자열 유틸이고 템플릿 검증은 빌더 통합 테스트다. 책임이 다르고 실패 시 원인 구분이 쉬워진다.

---

### Task 1: 폭 계산 함수

**Files:**
- Modify: `src/shared/lib/seo.ts`
- Test: `src/shared/lib/__tests__/seo.titleWidth.test.ts` (create)

- [ ] **Step 1: Write the failing test**

`src/shared/lib/__tests__/seo.titleWidth.test.ts`:

```ts
import { seoTitleWidth } from '@/shared/lib/seo';

describe('seoTitleWidth', () => {
    it('라틴 문자는 1단위로 센다', () => {
        expect(seoTitleWidth('AAPL')).toBe(4);
    });

    it('한글은 2단위로 센다', () => {
        expect(seoTitleWidth('애플')).toBe(4);
    });

    it('혼합 문자열을 가중 합산한다', () => {
        // 애플(2×2=4) + ( ) A A P L = 4 + 6 = 10
        expect(seoTitleWidth('애플(AAPL)')).toBe(10);
    });

    it('공백과 기호는 1단위다', () => {
        expect(seoTitleWidth(' — ')).toBe(3);
    });

    it('빈 문자열은 0이다', () => {
        expect(seoTitleWidth('')).toBe(0);
    });

    it('서로게이트 페어를 한 글자로 센다', () => {
        // 이모지는 전각 취급 → 2
        expect(seoTitleWidth('😀')).toBe(2);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleWidth.test.ts`
Expected: FAIL — `seoTitleWidth` is not exported from `@/shared/lib/seo`

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/seo.ts` — `clampSeoDescription` 정의 **바로 아래**에 추가:

```ts
/**
 * SERP에서 차지하는 시각적 폭을 근사한다 — 한글·전각 2, 그 외 1.
 *
 * Google 데스크톱 title 예산은 약 58~60 폭단위다. 글자 수로 재면 한글 제목의
 * 잘림을 예측할 수 없다: `AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선 | Siglens`은
 * 41글자지만 59 폭단위로 이미 경계에 있다(2026-07-26 실측).
 *
 * 코드포인트 기준으로 순회해 서로게이트 페어를 쪼개지 않는다
 * ({@link clampSeoDescription}과 동일한 방침).
 */
export function seoTitleWidth(text: string): number {
    let width = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0) ?? 0;
        width += isFullWidthCodePoint(cp) ? 2 : 1;
    }
    return width;
}

/**
 * 전각으로 취급할 코드포인트인지. 한글(자모·음절), CJK, 전각 기호, 이모지를 포함한다.
 * 범위는 Unicode East Asian Width의 W/F 구간 중 이 서비스가 실제로 다루는 것만 추렸다.
 */
function isFullWidthCodePoint(cp: number): boolean {
    return (
        (cp >= 0x1100 && cp <= 0x115f) || // 한글 자모
        (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK 부수 ~ 이(Yi)
        (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
        (cp >= 0xf900 && cp <= 0xfaff) || // CJK 호환 한자
        (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 호환 기호
        (cp >= 0xff00 && cp <= 0xff60) || // 전각 형태
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f) || // 이모지
        (cp >= 0x1f900 && cp <= 0x1f9ff)
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleWidth.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleWidth.test.ts
git commit -m "feat(seo): SERP 폭 근사 함수 seoTitleWidth 추가"
```

---

### Task 2: 폭 클램프 함수

**Files:**
- Modify: `src/shared/lib/seo.ts`
- Test: `src/shared/lib/__tests__/seo.titleWidth.test.ts`

- [ ] **Step 1: Write the failing test**

`src/shared/lib/__tests__/seo.titleWidth.test.ts` 하단에 추가:

```ts
import { clampSeoTitle, SEO_TITLE_MAX_WIDTH } from '@/shared/lib/seo';

describe('clampSeoTitle', () => {
    it('상한 이하면 그대로 반환한다', () => {
        const short = '애플(AAPL) 주가 전망';
        expect(clampSeoTitle(short)).toBe(short);
    });

    it('상한은 55다', () => {
        expect(SEO_TITLE_MAX_WIDTH).toBe(55);
    });

    it('초과 시 어절 경계에서 자르고 말줄임표를 붙인다', () => {
        const long =
            'ASE 테크놀로지 홀딩스(ASX) 옵션 분석 — Max Pain · OI · Put/Call · ATM IV';
        const clamped = clampSeoTitle(long);
        expect(seoTitleWidth(clamped)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
        expect(clamped.endsWith('…')).toBe(true);
        // 어절 중간에서 잘리지 않는다 — 말줄임표를 뗀 본문이 원문의 접두사이고,
        // 원문에서 그 바로 다음 문자가 공백(=어절 경계)이어야 한다.
        //
        // ⚠️ `/\S…$/`로 쓰지 말 것. 그건 이 성질이 아니라 "말줄임표 앞에 공백이
        // 있어야 한다"는 별개의 타이포그래피 규칙을 강제하고, 구현이 `"... OI …"`처럼
        // 어색한 공백을 넣게 만든다. 이 title은 SERP에 그대로 노출된다.
        const body = clamped.slice(0, -1);
        expect(long.startsWith(body)).toBe(true);
        expect(long[body.length]).toBe(' ');
    });

    it('공백이 없는 초장문도 상한을 넘기지 않는다', () => {
        const noSpace = '가'.repeat(100);
        const clamped = clampSeoTitle(noSpace);
        expect(seoTitleWidth(clamped)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });

    it('서로게이트 페어를 쪼개지 않는다', () => {
        const emoji = '😀'.repeat(40);
        const clamped = clampSeoTitle(emoji);
        expect([...clamped].every(c => c === '😀' || c === '…')).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleWidth.test.ts`
Expected: FAIL — `clampSeoTitle` / `SEO_TITLE_MAX_WIDTH` is not exported

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/seo.ts` — `seoTitleWidth` 아래에 추가:

```ts
/**
 * title 폭 상한. Google 데스크톱 예산 58~60에서 안전 여유를 둔 값이다.
 *
 * 이 상한은 **안전망**이지 상시 절단 수단이 아니다. 정상 템플릿은 클램프 없이
 * 통과해야 하며, `ASE 테크놀로지 홀딩스`(24 폭단위) 같은 예외적으로 긴
 * 한국어명에서만 발동한다.
 */
export const SEO_TITLE_MAX_WIDTH = 55;

/**
 * 폭 상한을 넘으면 어절 경계에서 잘라 말줄임표를 붙인다.
 *
 * 말줄임표 자체가 1 폭단위를 쓰므로 예산에서 미리 뺀다. 공백이 없어 경계를
 * 찾지 못하면 폭 기준으로 그냥 자른다(무한정 길어지는 것보다 낫다).
 */
export function clampSeoTitle(
    title: string,
    maxWidth: number = SEO_TITLE_MAX_WIDTH
): string {
    if (seoTitleWidth(title) <= maxWidth) return title;

    const budget = maxWidth - 1; // 말줄임표 자리
    const chars = [...title];
    let width = 0;
    let cut = 0;
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === undefined) break;
        const w = seoTitleWidth(ch);
        if (width + w > budget) break;
        width += w;
        cut = i + 1;
    }

    const head = chars.slice(0, cut).join('');
    const lastSpace = head.lastIndexOf(' ');
    const body = lastSpace > 0 ? head.slice(0, lastSpace) : head;
    return `${body.trimEnd()}…`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleWidth.test.ts`
Expected: PASS (11 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleWidth.test.ts
git commit -m "feat(seo): title 폭 클램프 clampSeoTitle 추가 (상한 55)"
```

---

### Task 3: title 주어 생성

**Files:**
- Modify: `src/shared/lib/seo.ts`
- Test: `src/shared/lib/__tests__/seo.titleSubject.test.ts` (create)

- [ ] **Step 1: Write the failing test**

`src/shared/lib/__tests__/seo.titleSubject.test.ts`:

```ts
import { buildTitleSubject } from '@/shared/lib/seo';

describe('buildTitleSubject', () => {
    it('한국어명이 있으면 한국어명(티커) 형태로 만든다', () => {
        expect(buildTitleSubject('AAPL', '애플')).toBe('애플(AAPL)');
    });

    it('한국어명이 없으면 티커만 반환한다', () => {
        expect(buildTitleSubject('AAPL')).toBe('AAPL');
    });

    it('빈 문자열 한국어명은 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '')).toBe('AAPL');
    });

    it('공백뿐인 한국어명도 없는 것으로 취급한다', () => {
        expect(buildTitleSubject('AAPL', '   ')).toBe('AAPL');
    });

    it('한국어명이 티커와 같으면 중복을 피해 티커만 반환한다', () => {
        expect(buildTitleSubject('SOXL', 'SOXL')).toBe('SOXL');
    });

    it('티커를 대문자로 정규화한다', () => {
        expect(buildTitleSubject('aapl', '애플')).toBe('애플(AAPL)');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: FAIL — `buildTitleSubject` is not exported

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/seo.ts` — `clampSeoTitle` 아래에 추가:

```ts
/**
 * title 전용 짧은 주어 — `애플(AAPL)`.
 *
 * `buildDisplayName`(`애플, Apple Inc. (AAPL)`, 22자)은 H1·본문용이라 title에는
 * 너무 길다. title 예산 58~60 폭단위 중 22자를 주어에 쓰면 검색 의도를 드러낼
 * 자리가 남지 않는다.
 *
 * `entities/ticker`가 아니라 여기 두는 이유: 12개 SEO 빌더가 전부
 * `BuildSymbolSeoOptions`(또는 이를 extends한 타입)를 받고 그 안에 `koreanName`이
 * 이미 있다. 여기서 파생하면 호출부 시그니처를 하나도 바꾸지 않는다.
 */
export function buildTitleSubject(
    ticker: string,
    koreanName?: string
): string {
    const upper = ticker.toUpperCase();
    const kr = koreanName?.trim();
    if (!kr || kr === upper) return upper;
    return `${kr}(${upper})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleSubject.test.ts
git commit -m "feat(seo): title 전용 주어 buildTitleSubject 추가"
```

---

### Task 4: 주식 템플릿 8개 전환

**Files:**
- Modify: `src/shared/lib/seo.ts` (라인 322, 488, 546, 602, 678, 729, 793, 1126 부근)
- Test: `src/shared/lib/__tests__/seo.titleSubject.test.ts`

각 빌더는 이미 `opts.koreanName`을 받는다. `const title = ...` 줄만 바꾸면 된다.

- [ ] **Step 1: Write the failing test**

`src/shared/lib/__tests__/seo.titleSubject.test.ts` 하단에 추가:

```ts
import {
    buildSymbolSeoContent,
    buildSymbolFinancialsSeoContent,
    buildSymbolCongressSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolOptionsSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
    buildSymbolFearGreedSeoContent,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
} from '@/shared/lib/seo';

/**
 * ⚠️ 이 타입 별칭이 필요한 이유: 배열에 `as const`만 붙이면 빌더들이 **유니온 타입**이
 * 되고, TS는 시그니처가 서로 다른 함수 유니온의 호출을 거부한다
 * (`buildSymbolOptionsSeoContent`만 `BuildSymbolOptionsSeoOptions`를 받는다).
 * 공통 호출 형태로 좁혀 두면 그 문제가 사라진다.
 */
type EquityBuilder = (
    symbol: string,
    opts?: { koreanName?: string; displayName?: string }
) => { title: string };

const EQUITY_BUILDERS: readonly (readonly [string, EquityBuilder])[] = [
    ['chart', buildSymbolSeoContent],
    ['financials', buildSymbolFinancialsSeoContent],
    ['congress', buildSymbolCongressSeoContent],
    ['fundamental', buildSymbolFundamentalSeoContent],
    ['options', buildSymbolOptionsSeoContent],
    ['news', buildSymbolNewsSeoContent],
    ['overall', buildSymbolOverallSeoContent],
    ['fear-greed', buildSymbolFearGreedSeoContent],
];

describe('주식 title 템플릿 — 한국어명 주입', () => {
    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 title 맨 앞에 온다',
        (_tab, build) => {
            const { title } = build('AAPL', { koreanName: '애플' });
            expect(title.startsWith('애플(AAPL)')).toBe(true);
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 한국어명이 없으면 티커로 degrade한다',
        (_tab, build) => {
            const { title } = build('AAPL');
            expect(title.startsWith('AAPL')).toBe(true);
            expect(title).not.toContain('undefined');
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 통상 한국어명에서 클램프 없이 상한을 통과한다',
        (_tab, build) => {
            const { title } = build('AAPL', { koreanName: '애플' });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
            expect(title.endsWith('…')).toBe(false);
        }
    );

    it.each(EQUITY_BUILDERS)(
        '%s: 예외적으로 긴 한국어명에서도 상한을 넘지 않는다',
        (_tab, build) => {
            const { title } = build('ASX', {
                koreanName: 'ASE 테크놀로지 홀딩스',
            });
            expect(seoTitleWidth(title)).toBeLessThanOrEqual(
                SEO_TITLE_MAX_WIDTH
            );
        }
    );

    it('fear-greed는 한국어 헤드 용어를 유지한다', () => {
        const { title } = buildSymbolFearGreedSeoContent('AAPL', {
            koreanName: '애플',
        });
        expect(title).toContain('공포 탐욕 지수');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: FAIL — 현재 title은 `AAPL 주가 분석…`이라 `애플(AAPL)`로 시작하지 않는다

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/seo.ts`의 8개 `const title = ...` 줄을 교체한다. 각 빌더 안에서 `subject`를 먼저 만든다.

```ts
// buildSymbolSeoContent (chart) — 기존 322 부근
const subject = buildTitleSubject(ticker, opts.koreanName);
const title = clampSeoTitle(`${subject} 주가 전망 — 차트·매매 신호`);

// buildSymbolFinancialsSeoContent — 기존 488 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 재무제표 — 매출·이익·현금흐름`);

// buildSymbolCongressSeoContent — 기존 546 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 의회 거래 — 상원·하원 매매 공시`);

// buildSymbolFundamentalSeoContent — 기존 602 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 펀더멘털 — PER·ROE와 컨센서스`);

// buildSymbolOptionsSeoContent — 기존 678 부근 (hasOptions 분기 유지)
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(
    hasOptions
        ? `${subject} 옵션 — Max Pain·OI·Put/Call`
        : `${subject} 옵션 분석`
);

// buildSymbolNewsSeoContent — 기존 729 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 뉴스 — 호재 분위기와 애널리스트 등급`);

// buildSymbolOverallSeoContent — 기존 793 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 종합 분석 — 강세·약세 시나리오`);

// buildSymbolFearGreedSeoContent — 기존 1126 부근
const subject = buildTitleSubject(upper, opts.koreanName);
const title = clampSeoTitle(`${subject} 공포 탐욕 지수 — 0~100 점수와 5단계`);
```

각 빌더에 이미 `const upper = symbol.toUpperCase()` 또는 `const ticker = symbol.toUpperCase()`가 있으니 그 변수를 그대로 쓴다. `fullTitle` 줄은 이 태스크에서 건드리지 않는다(Task 6에서 다룬다).

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: PASS (33 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleSubject.test.ts
git commit -m "feat(seo): 주식 title 템플릿 8개에 한국어 회사명 주입"
```

---

### Task 5: 크립토 템플릿 4개 전환

**Files:**
- Modify: `src/shared/lib/seo.ts` (라인 876, 936, 999, 1059 부근)
- Test: `src/shared/lib/__tests__/seo.titleSubject.test.ts`

크립토 챠트(876)는 현재 `${ticker} 시세 분석 — ${displayName} 차트와 매매 신호` 형태로 displayName 전체(`비트코인, Bitcoin USD (BTCUSD)`)가 들어가 **64 폭단위로 이미 넘친다.** 주식과 같은 형태로 통일한다.

- [ ] **Step 1: Write the failing test**

`src/shared/lib/__tests__/seo.titleSubject.test.ts` 하단에 추가:

```ts
import {
    buildCryptoSymbolSeoContent,
    buildCryptoSymbolNewsSeoContent,
    buildCryptoSymbolOverallSeoContent,
    buildCryptoSymbolFearGreedSeoContent,
} from '@/shared/lib/seo';

// Task 4의 `EquityBuilder`와 동일한 이유로 타입을 좁힌다.
const CRYPTO_BUILDERS: readonly (readonly [string, EquityBuilder])[] = [
    ['crypto-chart', buildCryptoSymbolSeoContent],
    ['crypto-news', buildCryptoSymbolNewsSeoContent],
    ['crypto-overall', buildCryptoSymbolOverallSeoContent],
    ['crypto-fear-greed', buildCryptoSymbolFearGreedSeoContent],
];

describe('크립토 title 템플릿 — 주식과 대칭', () => {
    it.each(CRYPTO_BUILDERS)(
        '%s: 한국어명이 title 맨 앞에 온다',
        (_tab, build) => {
            const { title } = build('BTCUSD', { koreanName: '비트코인' });
            expect(title.startsWith('비트코인(BTCUSD)')).toBe(true);
        }
    );

    it.each(CRYPTO_BUILDERS)('%s: 상한을 통과한다', (_tab, build) => {
        const { title } = build('BTCUSD', { koreanName: '비트코인' });
        expect(seoTitleWidth(title)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });

    it.each(CRYPTO_BUILDERS)(
        '%s: 한국어명이 없으면 티커로 degrade한다',
        (_tab, build) => {
            const { title } = build('BTCUSD');
            expect(title.startsWith('BTCUSD')).toBe(true);
        }
    );

    it('크립토 챠트가 더 이상 displayName 전체를 싣지 않는다', () => {
        const { title } = buildCryptoSymbolSeoContent('BTCUSD', {
            displayName: '비트코인, Bitcoin USD (BTCUSD)',
            koreanName: '비트코인',
        });
        expect(title).not.toContain('Bitcoin USD');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: FAIL — 크립토 title은 `BTCUSD 시세 분석 — …`로 시작한다

- [ ] **Step 3: Write minimal implementation**

```ts
// buildCryptoSymbolSeoContent — 기존 876 부근
const subject = buildTitleSubject(ticker, opts.koreanName);
const title = clampSeoTitle(`${subject} 시세 전망 — 차트·매매 신호`);

// buildCryptoSymbolNewsSeoContent — 기존 936 부근
const subject = buildTitleSubject(ticker, opts.koreanName);
const title = clampSeoTitle(`${subject} 코인 뉴스 — 호재 악재와 시장 분위기`);

// buildCryptoSymbolOverallSeoContent — 기존 999 부근
const subject = buildTitleSubject(ticker, opts.koreanName);
const title = clampSeoTitle(`${subject} 코인 종합 분석 — 강세·약세 시나리오`);

// buildCryptoSymbolFearGreedSeoContent — 기존 1059 부근
const subject = buildTitleSubject(ticker, opts.koreanName);
const title = clampSeoTitle(
    `${subject} 공포 탐욕 지수 — 0~100 점수와 5단계`
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: PASS (46 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleSubject.test.ts
git commit -m "feat(seo): 크립토 title 템플릿 4개를 주식과 동일 형태로 통일"
```

---

### Task 6: `| Siglens` 접미사 제거

**Files:**
- Modify: `src/shared/lib/seo.ts` (`symbolMetadataFromSeo`)
- Test: `src/shared/lib/__tests__/seo.titleSubject.test.ts`

`symbolMetadataFromSeo`가 `title`(맨몸)을 반환하면 루트 layout의 `template: '%s | Siglens'`가 접미사를 붙인다. `{ absolute }`로 감싸면 template을 건너뛴다. `/backtesting`이 이미 쓰는 패턴이다.

- [ ] **Step 1: Write the failing test**

```ts
import { symbolMetadataFromSeo, buildSymbolSeoContent } from '@/shared/lib/seo';

describe('symbolMetadataFromSeo — 접미사 처리', () => {
    const seo = buildSymbolSeoContent('AAPL', { koreanName: '애플' });

    it('title을 absolute로 반환해 루트 template을 우회한다', () => {
        const meta = symbolMetadataFromSeo(seo);
        expect(meta.title).toEqual({ absolute: seo.title });
    });

    it('absolute 값에 브랜드 접미사가 없다', () => {
        const meta = symbolMetadataFromSeo(seo);
        const absolute = (meta.title as { absolute: string }).absolute;
        expect(absolute).not.toContain('Siglens');
    });

    it('OG title은 접미사를 유지한다', () => {
        const meta = symbolMetadataFromSeo(seo);
        expect(meta.openGraph?.title).toBe(seo.fullTitle);
        expect(meta.openGraph?.title).toContain('Siglens');
    });

    it('Twitter title도 접미사를 유지한다', () => {
        const meta = symbolMetadataFromSeo(seo);
        expect(meta.twitter?.title).toBe(seo.fullTitle);
        expect(meta.twitter?.title).toContain('Siglens');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: FAIL — `meta.title`이 문자열이라 `{ absolute }`와 일치하지 않는다

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/seo.ts`의 `symbolMetadataFromSeo`:

```ts
export function symbolMetadataFromSeo(seo: SymbolSeoContent): Metadata {
    const { title, fullTitle, description, url, keywords } = seo;
    return {
        // `absolute`로 루트 layout의 `%s | Siglens` template을 우회한다.
        // 브랜드 쿼리 `siglens`는 이미 순위 2.0으로 이겼으므로, 2,247개 URL의
        // title 폭 예산을 이미 이긴 용어에 쓰는 건 낭비다(2026-07-26 GSC).
        // `/backtesting`이 쓰는 것과 같은 패턴이다.
        title: { absolute: title },
        description,
        keywords,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            // OG·Twitter는 `fullTitle`(접미사 포함)을 유지한다. 소셜 공유 카드에선
            // 브랜드가 유용하고 SERP 폭 제약과 무관하다.
            title: fullTitle,
            description,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/lib/__tests__/seo.titleSubject.test.ts`
Expected: PASS (50 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/seo.ts src/shared/lib/__tests__/seo.titleSubject.test.ts
git commit -m "feat(seo): 심볼 title에서 | Siglens 접미사 제거 (OG는 유지)"
```

---

### Task 7: 기존 테스트 갱신

**Files:**
- Modify: `src/shared/lib/__tests__/seo.test.ts`
- Modify: `src/shared/lib/__tests__/seo.crypto.test.ts`
- Modify: `src/shared/lib/__tests__/seoBranches.test.ts` (해당 시)

Task 4~6이 title 문자열을 바꿨으므로 기존 단언이 깨진다.

- [ ] **Step 1: 깨진 테스트 확인**

Run: `yarn test src/shared/lib/__tests__/`
Expected: FAIL — 옛 title 문자열을 기대하는 단언들

깨진 단언 목록을 기록한다.

- [ ] **Step 2: 단언 갱신**

각 실패 단언을 새 형태로 고친다. **하드코딩된 전체 title 문자열을 다시 하드코딩하지 말고**, 의미 있는 부분만 단언한다:

```ts
// 이전
expect(result.title).toBe('AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선');

// 이후 — 주어와 핵심어만 고정한다. 문구 미세 조정에 테스트가 깨지지 않는다.
expect(result.title).toContain('AAPL');
expect(result.title).toContain('주가 전망');
```

`fullTitle`을 단언하는 곳은 그대로 둔다. `fullTitle`은 여전히 접미사를 포함한다.

- [ ] **Step 3: 전체 통과 확인**

Run: `yarn test src/shared/lib/__tests__/`
Expected: PASS

- [ ] **Step 4: 전체 스위트 확인**

Run: `yarn test`
Expected: PASS — `src/app/**/__tests__/*metadata*` 등 다른 위치에서도 title을 단언할 수 있으니 전부 확인한다

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/__tests__/ src/app/
git commit -m "test(seo): title 형태 변경에 따른 기존 단언 갱신"
```

---

### Task 8: 게이트 통과 및 실증

**Files:** 없음 (검증만)

- [ ] **Step 1: 정적 게이트**

```bash
npx tsc --noEmit -p tsconfig.json
yarn lint
npx prettier --check .
yarn test
```

Expected: 전부 통과, 실패 0

- [ ] **Step 2: 프로덕션 빌드**

```bash
yarn build
```

Expected: exit 0

- [ ] **Step 3: 로컬 실증 — title 실측**

로컬 프로덕션 서버를 띄운 뒤:

```bash
for u in /AAPL /NVDA /BTCUSD /AAPL/fear-greed /AAPL/options /ASX; do
  printf "%-18s " "$u"
  curl -s --max-time 60 "http://127.0.0.1:3100$u" \
    | grep -oE '<title>[^<]*</title>' | sed 's/<[^>]*>//g'
done
```

Expected:
- `/AAPL` → `애플(AAPL) 주가 전망 — 차트·매매 신호` (접미사 **없음**)
- `/BTCUSD` → `비트코인(BTCUSD) 시세 전망 — 차트·매매 신호`
- `/ASX` → 잘리지 않고 55 폭단위 이하
- 어느 것에도 `| Siglens`가 없다

- [ ] **Step 4: 로컬 실증 — OG는 접미사 유지 확인**

```bash
curl -s --max-time 60 "http://127.0.0.1:3100/AAPL" \
  | grep -oE '<meta property="og:title" content="[^"]*"'
```

Expected: `Siglens`가 포함된 `fullTitle`

- [ ] **Step 5: 회귀 확인**

```bash
for u in /AAPL /NVDA/news /BTCUSD/overall /market /economy; do
  printf "%-18s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://127.0.0.1:3100$u)"
done
```

Expected: 전부 200

- [ ] **Step 6: Commit (필요 시)**

실증 중 수정이 없었다면 커밋할 것이 없다. 있었다면:

```bash
git add -A
git commit -m "fix(seo): 실증에서 발견한 title 폭 초과 수정"
```

---

## 배포 후 관측

배포 뒤 **2~3주간 아래만 본다.** Part B는 이 관측이 끝난 뒤 시작한다.

| 지표 | 기준선 (2026-07-26) | 기대 방향 |
| --- | --- | --- |
| GSC 평균 게재순위 | 18.7 | 하락(개선) |
| 비브랜드 노출 | 96/일 | 상승 |
| 브랜드 쿼리 `siglens` 순위 | 2.0 | 유지 — 접미사 제거로 나빠지지 않아야 한다 |

브랜드 순위가 나빠지면 접미사 제거가 원인이므로 Task 6만 되돌린다. 나머지는 유지한다.
