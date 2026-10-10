import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import { modifyRouteRegex } from 'next/dist/lib/redirect-status';
import {
    CACHE_TAG_HEADER,
    CDN_CACHE_TAG,
    CDN_CACHE_TAG_HEADER_RULES,
    DEPLOY_PURGE_TAGS,
} from '../cdnCacheTags';

/**
 * 런타임 라우터와 같은 방식으로 규칙을 맞춰(next/dist/server/lib/router-utils/
 * filesystem.js `buildCustomRoute`의 header 분기) 일치하는 규칙을 순서대로 적용하고,
 * 마지막에 남은 `Cache-Tag`를 돌려준다(resolve-routes.js `resHeaders[key] = value`).
 */
function resolveCacheTag(pathname: string): string | undefined {
    return CDN_CACHE_TAG_HEADER_RULES.reduce<string | undefined>(
        (current, rule) => {
            const match = getPathMatch(rule.source, {
                strict: true,
                removeUnnamedParams: true,
                regexModifier: regex => modifyRouteRegex(regex),
            });
            if (match(pathname) === false) return current;
            const header = rule.headers.find(h => h.key === CACHE_TAG_HEADER);
            return header?.value ?? current;
        },
        undefined
    );
}

describe('CDN_CACHE_TAG_HEADER_RULES', () => {
    it.each([
        '/',
        '/ko',
        '/AAPL',
        '/en/AAPL/overall',
        '/BRK.B',
        '/005930.KS/fundamental',
        '/news/us',
        '/sitemap.xml',
        '/rss.xml',
        '/robots.txt',
        '/manifest.webmanifest',
        '/sw.js',
        '/offline.html',
        '/api/health',
        // 확장자가 미디어가 아닌 라우트 핸들러·리라이트 — 빌드·데이터에 따라 바뀐다.
        '/ko/manifest.webmanifest',
        '/sitemap-popular.xml',
        '/sitemap-longtail-3.xml',
        '/sitemap-removal-symbols.xml',
        // `/api/ai/og` 접두사가 아닌 다른 api 경로는 OG가 아니다.
        '/api/ai/chat/stream',
    ])('빌드 산출물에 따라 바뀌는 %s는 배포마다 지우는 HTML 태그다', path => {
        expect(resolveCacheTag(path)).toBe(CDN_CACHE_TAG.html);
    });

    it.each([
        '/AAPL/opengraph-image',
        '/en/AAPL/fundamental/twitter-image',
        '/AAPL/opengraph-image-1a2b3c',
        '/news/us/opengraph-image/0',
        // 확장자가 붙어도 미디어 규칙이 아니라 OG 규칙이 이긴다.
        '/AAPL/opengraph-image.png',
        // SIGLENS AI 공유 카드 — `.png`지만 코드로 그린다(app/api/ai/og/[file]/route.tsx).
        '/api/ai/og/ko.png',
        '/api/ai/og/en.png',
        // 옛 쿼리스트링 경로(app/api/ai/og/route.tsx).
        '/api/ai/og',
    ])('코드로 그리는 공유 카드 %s는 배포와 무관한 OG 태그다', path => {
        expect(resolveCacheTag(path)).toBe(CDN_CACHE_TAG.og);
    });

    it.each([
        '/_next/static/chunks/abc123.js',
        '/_next/static/css/def456.css',
        '/_next/static/media/font.woff2',
        '/_next/image',
        '/icon192.png',
        '/og-image.png',
        '/hero-dashboard.svg',
        '/favicon.ico',
        // app/ 루트의 파일 메타데이터(파일 그대로 서빙, 링크에 내용 해시 쿼리가 붙는다).
        '/icon.png',
        '/apple-icon.png',
    ])('immutable·정적 미디어 %s는 지우지 않는 asset 태그다', path => {
        expect(resolveCacheTag(path)).toBe(CDN_CACHE_TAG.asset);
    });

    it('세그먼트 이름이 opengraph-image로 시작하지 않으면 OG로 보지 않는다', () => {
        expect(resolveCacheTag('/news/my-opengraph-image-story')).toBe(
            CDN_CACHE_TAG.html
        );
    });

    it('배포는 HTML 태그만 지운다', () => {
        expect(DEPLOY_PURGE_TAGS).toEqual([CDN_CACHE_TAG.html]);
    });

    it('next.config.ts가 규칙을 headers()에 펼친다', () => {
        const source = readFileSync(
            join(process.cwd(), 'next.config.ts'),
            'utf8'
        );
        expect(source).toContain('...CDN_CACHE_TAG_HEADER_RULES');
    });
});

const MEDIA_EXTENSION =
    /\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp4|webm)$/;

function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = join(dir, entry.name);
        if (!entry.isDirectory()) return [full];
        return entry.name === '__tests__' ? [] : walk(full);
    });
}

/** 동적 파일명 세그먼트(`[file]`)거나 디렉터리 이름 자체가 미디어 확장자인 라우트 핸들러. */
function isMediaPathRoute(file: string): boolean {
    if (!/\/route\.tsx?$/.test(file)) return false;
    const dirs = file.split('/').slice(0, -1);
    return (
        dirs.includes('[file]') || dirs.some(dir => MEDIA_EXTENSION.test(dir))
    );
}

/**
 * 미디어 확장자로 서빙될 수 있는 app 라우트를 새로 만들면 여기서 걸린다. 확장자 규칙은 그런
 * 경로를 `siglens-asset`(배포 때 안 지움)으로 분류하므로, 코드로 그리는 이미지라면 OG 규칙을
 * 더해야 한다. 분류를 확인하고 아래 목록과 위 경로 테스트에 함께 올린다.
 */
describe('미디어 확장자로 서빙될 수 있는 app 라우트 감사', () => {
    const REVIEWED: Record<string, { path: string; tag: string }> = {
        'src/app/api/ai/og/[file]/route.tsx': {
            path: '/api/ai/og/ko.png',
            tag: CDN_CACHE_TAG.og,
        },
        // 파일 메타데이터 — 파일 그대로 서빙된다.
        'src/app/icon.png': { path: '/icon.png', tag: CDN_CACHE_TAG.asset },
        'src/app/apple-icon.png': {
            path: '/apple-icon.png',
            tag: CDN_CACHE_TAG.asset,
        },
        'src/app/favicon.ico': {
            path: '/favicon.ico',
            tag: CDN_CACHE_TAG.asset,
        },
    };

    // app/ 안의 이미지 중 Next가 URL로 서빙하는 건 파일 메타데이터뿐이다. 그 밖의 파일
    // (`app/fonts/*.woff2` 등)은 import돼 `/_next/static/media`로 나간다.
    const METADATA_IMAGE =
        /(?:^|\/)(?:icon|apple-icon|favicon|opengraph-image|twitter-image)\d*\.[a-z0-9]+$/;
    const found = walk(join(process.cwd(), 'src/app'))
        .map(file => relative(process.cwd(), file))
        .filter(
            file =>
                isMediaPathRoute(file) ||
                (METADATA_IMAGE.test(file) && MEDIA_EXTENSION.test(file))
        )
        .sort();

    it('후보가 모두 분류를 확인한 목록에 있다', () => {
        expect(found).toEqual(Object.keys(REVIEWED).sort());
    });

    it.each(Object.entries(REVIEWED))(
        '%s는 의도한 태그로 분류된다',
        (_file, { path, tag }) => {
            expect(resolveCacheTag(path)).toBe(tag);
        }
    );
});
