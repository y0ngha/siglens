import {
    STATIC_INDEXABLE_LOCALES,
    SYMBOL_INDEXABLE_LOCALES,
} from '@/shared/i18n/indexableLocales';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(process.cwd(), 'src/app/[locale]');

/** `src/app/[locale]` 아래의 모든 page 파일. */
function collectPages(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === '__tests__' || name.startsWith('_')) continue;
            collectPages(full, acc);
        } else if (name === 'page.tsx' || name === 'page.ts') {
            acc.push(full);
        }
    }
    return acc;
}

const PAGES = collectPages(APP_DIR);

/**
 * 무조건 noindex인 페이지(로그인·회원가입·계정·공유 링크 등)는 이 가드에서 제외한다.
 *
 * 색인되지 않으므로 hreflang이 무의미하고, canonical을 로케일 없는 URL로 고정하는
 * 편이 오히려 낫다(중복 URL이 하나로 모인다). 조건부 noindex(`degraded`)는 정상
 * 경로에서 색인되므로 제외 대상이 아니다 — 그래서 삼항/변수 분기가 아니라
 * **리터럴 `index: false`**만 본다.
 */
function isAlwaysNoindex(source: string): boolean {
    return /robots:\s*\{[^}]*index:\s*false/.test(source);
}

/**
 * `robots` 선언이 페이지가 아니라 별도 빌더에 있는 noindex 라우트.
 *
 * 이 가드는 페이지 **소스 텍스트**만 읽으므로 위임된 선언을 볼 수 없다. 임포트를
 * 따라가는 정적 분석을 붙이는 대신 목록으로 둔다 — 항목이 하나뿐이고, 새 항목이
 * 생기면 이 테스트가 실패해서 사람이 이유를 적게 된다(조용한 누락이 아니다).
 */
const NOINDEX_BY_BUILDER: readonly string[] = [
    // `entities/shared-analysis/lib/buildShareSeo.ts`가 robots noindex를 낸다.
    // 공유 스냅샷은 시세가 고정돼 있어 색인 대상이 아니다.
    'share/[id]/page.tsx',
];

/**
 * 서버 컴포넌트인 페이지. 클라이언트 컴포넌트는 `setRequestLocale`을 부를 수 없다
 * (next-intl이 명시적으로 던진다) — 로케일은 `NextIntlClientProvider` 컨텍스트로 온다.
 */
const SERVER_PAGES = PAGES.filter(page => {
    const head = readFileSync(page, 'utf8').slice(0, 200);
    return !head.includes("'use client'") && !head.includes('"use client"');
});

const INDEXABLE_PAGES = PAGES.filter(page => {
    if (NOINDEX_BY_BUILDER.some(suffix => page.endsWith(suffix))) return false;
    return !isAlwaysNoindex(readFileSync(page, 'utf8'));
});

/**
 * 로케일 커버리지 회귀 가드.
 *
 * 새 라우트가 i18n 배선 없이 들어오는 것을 막는다. 페이지 모듈을 import하지 않고
 * **소스 텍스트**를 검사하는 이유는, 페이지 모듈이 DB·외부 API 어댑터를 끌고 와
 * 테스트에서 전부 mock해야 하기 때문이다 — 그 비용을 치르면 이 가드는 결국
 * 유지되지 않는다.
 */
describe('로케일 커버리지', () => {
    it('페이지 목록이 비어 있지 않다 — 비면 아래 가드가 통째로 무력화된다', () => {
        expect(PAGES.length).toBeGreaterThanOrEqual(30);
        expect(INDEXABLE_PAGES.length).toBeGreaterThanOrEqual(15);
    });

    /**
     * Next.js는 세그먼트 간 메타데이터를 최상위 키 단위로 **교체**한다. 페이지가
     * `alternates`를 직접 리터럴로 선언하면 그 순간 hreflang이 사라진다 —
     * 빌드도 타입체크도 통과하고 HTML에서만 조용히 빠진다(실측).
     */
    it.each(INDEXABLE_PAGES)(
        '%s: alternates를 리터럴로 선언하지 않는다',
        page => {
            const source = readFileSync(page, 'utf8');
            const hasLiteralAlternates = /alternates:\s*\{/.test(source);
            if (!hasLiteralAlternates) return;

            // `canonical: null`만 있는 noindex 분기는 예외 — hreflang을 붙이면 안 된다.
            const literals = source.match(/alternates:\s*\{[^}]*\}/g) ?? [];
            for (const literal of literals) {
                expect(literal.replace(/\s+/g, ' ')).toMatch(
                    /alternates: \{ canonical: null,? \}/
                );
            }
        }
    );

    /** 로케일을 읽지 않는 페이지는 어떤 로케일에서도 ko 메타데이터를 낸다. */
    it.each(INDEXABLE_PAGES)('%s: 메타데이터가 로케일을 반영한다', page => {
        const source = readFileSync(page, 'utf8');
        const declaresMetadata =
            source.includes('export const metadata') ||
            source.includes('export async function generateMetadata');
        if (!declaresMetadata) return;

        expect(source).toMatch(
            /localeAlternatesFrom|localeAlternates\(|symbolMetadataFromSeo\(/
        );
    });

    /**
     * `setRequestLocale` 누락은 **ISR을 조용히 끈다**.
     *
     * 실측: `backtesting/page.tsx`에 `getTranslations`를 넣고 `setRequestLocale`을
     * 빼면 빌드 route 표에서 `● /[locale]/backtesting`이 `ƒ`로 바뀐다. next-intl의
     * 서버 API가 요청 로케일을 못 찾으면 `headers()`로 폴백해 라우트가 dynamic이
     * 되기 때문이다(Next 16.2는 `next/root-params` 미지원).
     *
     * 이 가드가 없으면 Phase 2에서 페이지 하나에 번역을 넣는 순간 그 라우트의 ISR이
     * 사라지고, 빌드는 성공하며 테스트도 통과한다 — 캐시 비용 청구서로만 드러난다.
     */
    it.each(SERVER_PAGES)('%s: setRequestLocale을 호출한다', page => {
        expect(readFileSync(page, 'utf8')).toContain('setRequestLocale(');
    });

    /**
     * 정적 `export const metadata`는 로케일을 알 수 없다. 로케일 세그먼트 아래에서는
     * 반드시 `generateMetadata({ params })` 형태여야 한다.
     */
    it.each(INDEXABLE_PAGES)('%s: 정적 metadata export를 쓰지 않는다', page => {
        const source = readFileSync(page, 'utf8');
        expect(source).not.toMatch(/export const metadata\b/);
    });
});

/** page 이외의 라우트 파일(loading/error/not-found/template). */
/**
 * `global-error.tsx`는 `[locale]` 밖(`src/app/`)에 있으므로 여기서 따로 더한다.
 * 파일명 정규식에만 넣어 두면 그 갈래는 영원히 0건 매치라, 있지도 않은 커버리지를
 * 있는 것처럼 읽히게 한다.
 */
const EXTRA_ROUTE_FILES = [join(process.cwd(), 'src/app/global-error.tsx')];

function collectRouteFiles(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === '__tests__' || name.startsWith('_')) continue;
            collectRouteFiles(full, acc);
        } else if (
            /^(layout|loading|error|not-found|template|default|global-error)\.tsx?$/.test(
                name
            )
        ) {
            acc.push(full);
        }
    }
    return acc;
}

/**
 * `page.tsx` 밖의 라우트 파일에서 서버 `useTranslations` 금지.
 *
 * ## 무엇이 터졌었나
 *
 * `loading.tsx`는 서버 컴포넌트인데 `params`를 받지 못해 `setRequestLocale`을
 * 부를 수 없다. 그 상태로 `useTranslations`를 호출하면 next-intl이 `headers()`로
 * 폴백해 **정적 렌더가 중단**되고, ISR 콜드 생성이 `DYNAMIC_SERVER_USAGE`로
 * 실패한다. 결과는 `/AAPL`을 포함한 **모든 종목 페이지 500**이었고, 없는 심볼도
 * 404가 아니라 500이 되어 soft 404가 재발했다. 빌드도 타입체크도 테스트도 통과했다
 * — 실제 HTTP 요청을 보내야만 보였다.
 *
 * 기존 커버리지 가드는 `page.tsx`만 수집해서 이 클래스를 통째로 못 봤다.
 * `layout.tsx`도 같은 이유로 포함한다 — 31개 중첩 레이아웃이 빠져 있었고,
 * 그중 둘은 이미 `next-intl/server`를 import한다. 레이아웃에
 * `getTranslations({ namespace })`를 넣어도 106개 테스트가 초록이었다(실측).
 */
describe('page 밖 라우트 파일의 로케일 안전성', () => {
    const ROUTE_FILES = [...collectRouteFiles(APP_DIR), ...EXTRA_ROUTE_FILES];

    it('수집 대상이 비어 있지 않다', () => {
        expect(ROUTE_FILES.length).toBeGreaterThan(5);
    });

    it.each(ROUTE_FILES)('%s', file => {
        const source = readFileSync(file, 'utf8');
        /**
         * 요청 스코프 로케일을 요구하는 next-intl API를 **import 구문에서** 찾는다.
         *
         * 주석·JSDoc의 이름 언급은 무시해야 하고(이 클래스를 설명하는 주석이
         * 파일마다 붙어 있다), 동시에 다음 두 사각지대를 덮어야 한다:
         *  - 여러 줄로 쪼개진 import (oxfmt `printWidth: 80`이 실제로 쪼갠다)
         *  - `next-intl/server`의 `getTranslations`/`getLocale`/`getFormatter`
         *    — `useTranslations`와 **같은** `DYNAMIC_SERVER_USAGE` 500을 낸다
         */
        const importBlocks = source.match(
            /^\s*import\s[\s\S]*?from\s+'next-intl(?:\/server)?';/gm
        );
        const usesRequestScopedApi = (importBlocks ?? []).some(block =>
            /\b(useTranslations|useFormatter|useNow|getTranslations|getLocale|getFormatter|getNow)\b/.test(
                block
            )
        );
        if (!usesRequestScopedApi) return;

        /**
         * **명시적 로케일을 넘기는 호출은 안전하다.** `getTranslations({ locale })`은
         * 요청 스코프를 보지 않으므로 `headers()`로 폴백하지 않는다 — 정적 생성이
         * 깨지지 않는다(빌드 route 표의 `●` 26개로 확인). 위험한 건 인자 없는
         * `getTranslations()`·`useTranslations(...)`처럼 요청 스코프를 요구하는
         * 형태다. 이걸 구분하지 않으면 로케일을 올바르게 넘긴 코드까지 막게 된다.
         */
        const hookCalls =
            /\buseTranslations\s*\(|\buseFormatter\s*\(|\buseNow\s*\(|\bgetLocale\s*\(|\bgetNow\s*\(/.test(
                source
            );
        /**
         * `getTranslations`/`getFormatter`는 **명시적 `locale`을 넘길 때만**
         * 안전하다. 인자 없는 형태(`getTranslations()`), 네임스페이스 문자열
         * (`getTranslations('ns')`), 그리고 `locale` 없는 객체 형태
         * (`getTranslations({ namespace })`)는 전부 요청 스코프를 요구해
         * 같은 `DYNAMIC_SERVER_USAGE` 500을 낸다. 세 번째를 빠뜨리면 라운드 1의
         * 종목 페이지 전면 500이 그대로 재발한다(실측으로 확인).
         *
         * `[:,}]`까지 보는 이유는 **속성 축약**(`{ locale, namespace }`) 때문이다.
         * `locale:`만 찾으면 안전한 축약형을 위험으로 잘못 잡는다.
         */
        const serverCalls = [
            ...source.matchAll(
                /\b(?:getTranslations|getFormatter)\s*\(([\s\S]{0,200}?)\)/g
            ),
        ];
        const unsafeServerCall = serverCalls.some(
            match => !/\blocale\s*[:,}]/.test(match[1]!)
        );
        if (!hookCalls && !unsafeServerCall) return;
        // 클라이언트 컴포넌트는 NextIntlClientProvider에서 로케일을 받으므로 안전하다.
        expect(source.startsWith("'use client'")).toBe(true);
    });
});

/**
 * 색인 게이트를 여는 순간 **JSON-LD가 거짓말을 시작한다**.
 *
 * `/[locale]` 아래 정적/허브 페이지들의 JSON-LD는 모듈 상수라 `inLanguage`뿐
 * 아니라 `@id`·`url`·`name`·`description`까지 전부 기본 로케일로 굳어 있다.
 * 지금은 무해하다 — 비-ko 표면이 전부 noindex라 크롤러가 그 블록을 읽지 않는다.
 *
 * 문제는 설계가 "상수 하나만 뒤집으면 로케일 추가"라고 약속한다는 점이다.
 * 그 약속대로 뒤집으면 영어 URL이 `inLanguage: "ko"`와 한국어 `name`을 달고
 * 색인된다 — 2026-07 thin-content 붕괴와 같은 신호다.
 *
 * 그래서 게이트를 여는 그 커밋에서 **여기서 멈추게** 한다. 지금 12개 상수를
 * 로케일 함수로 바꾸는 것보다 이쪽이 정확하다: 게이트를 열 때는 URL·제목·설명도
 * 같이 로케일화해야 하는데, 그건 이 테스트가 강제하는 작업 목록 그 자체다.
 */
/** `src` 아래 모든 소스 파일(테스트 제외). JSON-LD는 page 밖에도 있다. */
function collectSources(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === '__tests__') continue;
            collectSources(full, acc);
        } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
            acc.push(full);
        }
    }
    return acc;
}

describe('JSON-LD 로케일 하드코딩 가드', () => {
    it('색인 게이트가 열리면 하드코딩된 JSON-LD를 먼저 걷어내야 한다', () => {
        const gatesOpen =
            STATIC_INDEXABLE_LOCALES.length > 1 ||
            SYMBOL_INDEXABLE_LOCALES.length > 1;

        const hardcoded = collectSources(join(process.cwd(), 'src')).filter(
            file => /inLanguage:\s*'ko'/.test(readFileSync(file, 'utf8'))
        );

        if (!gatesOpen) {
            // 게이트가 닫혀 있는 동안은 존재 자체가 정상이다. 다만 이 테스트가
            // 대상 파일을 하나도 못 찾는 상태로 조용히 통과하면 안 된다.
            expect(hardcoded.length).toBeGreaterThan(0);
            return;
        }

        expect(hardcoded).toEqual([]);
    });
});
