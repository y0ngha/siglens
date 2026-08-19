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
