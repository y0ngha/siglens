/**
 * IndexNow 1회성 백필의 순수 helper — DB·Redis·네트워크 없이 URL 목록만 만든다.
 *
 * 대상 셋:
 *  1. removal sitemap(`/api/sitemap/removal/{kind}`)이 광고하던 URL — 이미 색인에서 빠진 URL이라
 *     검색엔진에 "다시 가져가 보라"고 알린다.
 *  2. 2026-10-01에 `POPULAR_TICKERS`에서 제거된 C 구간 43종(커밋 `0a1f00b7b`)의 URL.
 *     더 이상 설정 파일에 없으므로 여기에 상수로 박아 둔다.
 *  3. 큐레이션 종목·크립토의 **항상-noindex 탭** 6종 URL(차트·뉴스·공포탐욕을 뺀 나머지 중 노출됐던 탭).
 */

export const BACKFILL_SITE_URL = 'https://siglens.io';

/** IndexNow 요청 하나의 `urlList` 상한(`INDEXNOW_MAX_URLS_PER_REQUEST`와 같다). */
export const BACKFILL_CHUNK_SIZE = 10_000;

export const REMOVAL_SITEMAP_KINDS = [
    'chart',
    'news',
    'overall',
    'fundamental',
    'fear-greed',
] as const;

/** 커밋 `0a1f00b7b`가 `POPULAR_TICKERS`에서 뺀 C 구간 43종. */
export const REMOVED_C_SEGMENT_TICKERS: readonly string[] = [
    'QSPT',
    'GPUS',
    'MRVU',
    'MUU',
    'OPGN',
    'MVLL',
    'CUPR',
    'MSTY',
    'ORCX',
    'RKLZ',
    'ASBP',
    'RAM',
    'RKLX',
    'CERO',
    'BTDG',
    'RGTIW',
    'EDHL',
    'AMZE',
    'FFFVX',
    'CSOC',
    'ASTC',
    'GLXG',
    'RGTX',
    'PLTY',
    'MX',
    'IONZ',
    'CPOP',
    'SDOT',
    'TRPSX',
    'NEWTI',
    'BGMS',
    'INHD',
    'NOWL',
    'ELYM',
    'TNEN',
    'SLRK',
    'BNAIW',
    'GMEI',
    'HSCS',
    'XDIV',
    'QTOP',
    'UNBX',
    'LENZ',
];

/** 종목별 항상-noindex 탭(`ALWAYS_NOINDEX_TAB_ROBOTS` 다섯 + `/position`). */
export const ALWAYS_NOINDEX_TABS = [
    'overall',
    'fundamental',
    'financials',
    'congress',
    'options',
    'position',
] as const;

/** C 구간 종목에 대해 알릴 탭 — 색인됐던 탭 전부(차트·뉴스·공포탐욕 + 옛 noindex 탭). */
const REMOVED_SYMBOL_PATHS = [
    '',
    '/news',
    '/fear-greed',
    ...ALWAYS_NOINDEX_TABS.map(tab => `/${tab}`),
];

/** removal sitemap XML에서 `<loc>`을 뽑는다. 값은 XML 엔티티를 풀어 돌려준다. */
export function parseSitemapLocs(xml: string): string[] {
    return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match =>
        match[1]
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
            .replaceAll('&apos;', "'")
    );
}

export function removalSitemapUrl(kind: string): string {
    return `${BACKFILL_SITE_URL}/api/sitemap/removal/${kind}`;
}

export function removedSegmentUrls(): string[] {
    return REMOVED_C_SEGMENT_TICKERS.flatMap(symbol =>
        REMOVED_SYMBOL_PATHS.map(
            path => `${BACKFILL_SITE_URL}/${symbol}${path}`
        )
    );
}

export function alwaysNoindexTabUrls(symbols: readonly string[]): string[] {
    return symbols.flatMap(symbol =>
        ALWAYS_NOINDEX_TABS.map(
            tab => `${BACKFILL_SITE_URL}/${symbol.toUpperCase()}/${tab}`
        )
    );
}

/** 중복을 없애고(순서 유지) 운영 호스트의 URL만 남긴다. */
export function normalizeBackfillUrls(urls: readonly string[]): string[] {
    const seen = new Set<string>();
    for (const url of urls) {
        if (URL.canParse(url) && new URL(url).host === 'siglens.io') {
            seen.add(url);
        }
    }
    return [...seen];
}

export function chunkUrls(urls: readonly string[], size: number): string[][] {
    return Array.from({ length: Math.ceil(urls.length / size) }, (_, i) =>
        urls.slice(i * size, (i + 1) * size)
    );
}

/**
 * `--from-chunk N`(1부터)을 해석한다. 없으면 1. 정수가 아니거나 1 미만이면 `null`.
 */
export function parseFromChunk(raw: string | undefined): number | null {
    if (raw === undefined) return 1;
    return /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

/**
 * `--save`로 저장한 URL 목록(한 줄에 하나)을 읽는다. 빈 줄·`#` 주석 줄은 건너뛰고, 중복과
 * 운영 호스트가 아닌 URL은 걸러(`normalizeBackfillUrls`) 순서를 유지한다.
 */
export function parseUrlList(text: string): string[] {
    return normalizeBackfillUrls(
        text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'))
    );
}

/** `parseUrlList`의 역 — 한 줄에 URL 하나, 끝에 개행. */
export function formatUrlList(urls: readonly string[]): string {
    return urls.length === 0 ? '' : `${urls.join('\n')}\n`;
}

export interface BackfillArgs {
    readonly submit: boolean;
    readonly fromChunk: number;
    readonly saveFile: string | null;
    readonly fromFile: string | null;
}

/**
 * CLI 인자를 해석한다. 잘못된 조합은 `{ error }`로 돌려준다(호출부가 출력하고 종료한다).
 *
 * `--save`는 제출하지 않는 모드라 `--submit`과 함께 쓸 수 없다. `--from-file`은 sitemap을
 * 받지 않고 저장된 목록을 쓴다 — 청크 번호와 재개(`--from-chunk`)가 같은 목록에서 움직인다.
 */
export function parseBackfillArgs(
    argv: readonly string[]
): BackfillArgs | { readonly error: string } {
    const valueOf = (flag: string): string | null | undefined => {
        const index = argv.indexOf(flag);
        if (index === -1) return undefined;
        const value = argv[index + 1];
        return value === undefined || value.startsWith('--') ? null : value;
    };
    const fromChunkRaw = valueOf('--from-chunk');
    const fromChunk = parseFromChunk(fromChunkRaw === null ? '' : fromChunkRaw);
    if (fromChunk === null) {
        return { error: '--from-chunk는 1 이상의 정수여야 한다.' };
    }
    const saveFile = valueOf('--save');
    const fromFile = valueOf('--from-file');
    if (saveFile === null) return { error: '--save에는 파일 경로가 필요하다.' };
    if (fromFile === null) {
        return { error: '--from-file에는 파일 경로가 필요하다.' };
    }
    const submit = argv.includes('--submit');
    if (saveFile !== undefined && submit) {
        return {
            error: '--save는 제출하지 않는다 — --submit과 함께 쓸 수 없다.',
        };
    }
    return {
        submit,
        fromChunk,
        saveFile: saveFile ?? null,
        fromFile: fromFile ?? null,
    };
}
