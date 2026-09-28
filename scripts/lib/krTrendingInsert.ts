/**
 * 방문 기반 KR 후보를 `popular-tickers.ts`에 넣는 텍스트 편집 — 순수 함수.
 *
 * KR 종목은 두 곳에 **같이** 들어가야 한다(`popular-tickers.test.ts` 합집합 불변식):
 *  1. `TICKER_CATEGORIES`의 `kr-trending` 카테고리 — 홈 그리드가 한국 종목 페이지로 가는
 *     유일한 크롤 가능 링크다.
 *  2. `POPULAR_TICKERS`의 KR 블록 — sitemap·색인 판정·프리웜의 입력.
 *
 * 카테고리 객체는 첫 후보 때 만든다. 빈 카테고리를 config에 미리 두면 `items.length > 0`
 * 검사가 깨진다. 라인 번호가 아니라 앵커 문자열로 위치를 찾고, 앵커가 없으면 던진다.
 */
import { extractExistingKrTickers } from './visitCandidates';

export interface KrTrendingItem {
    symbol: string;
    name: string;
}

export const KR_TRENDING_CATEGORY_ID = 'kr-trending';
export const KR_TRENDING_LABEL = '관심 급상승';

const CATEGORIES_DECLARATION =
    'export const TICKER_CATEGORIES: readonly TickerCategory[] = [';
const CATEGORIES_END = '\n];\n';
const CATEGORY_ITEMS_END = '\n        ],';
const POPULAR_DECLARATION = 'export const POPULAR_TICKERS = [';
const POPULAR_END = '] as const;';
const KR_POPULAR_LINE_RE = /^ {4}'\d{6}\.K[SQ]',.*$/gm;

function quote(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function insertIntoCategory(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    const declAt = content.indexOf(CATEGORIES_DECLARATION);
    if (declAt === -1) {
        throw new Error('TICKER_CATEGORIES declaration not found');
    }
    const endAt = content.indexOf(CATEGORIES_END, declAt);
    if (endAt === -1) throw new Error('TICKER_CATEGORIES end not found');

    const itemLines = items
        .map(
            i =>
                `            { symbol: ${quote(i.symbol)}, name: ${quote(i.name)} },`
        )
        .join('\n');

    const idAt = content.indexOf(`id: '${KR_TRENDING_CATEGORY_ID}',`, declAt);
    if (idAt !== -1 && idAt < endAt) {
        const itemsEnd = content.indexOf(CATEGORY_ITEMS_END, idAt);
        if (itemsEnd === -1 || itemsEnd > endAt) {
            throw new Error('kr-trending items array end not found');
        }
        return `${content.slice(0, itemsEnd)}\n${itemLines}${content.slice(itemsEnd)}`;
    }

    const block = [
        '',
        '    {',
        `        id: '${KR_TRENDING_CATEGORY_ID}',`,
        `        label: '${KR_TRENDING_LABEL}',`,
        '        // update-popular-tickers.ts가 방문 조회수로 채운다. 업종이 아니라 수요',
        '        // 묶음이라 relatedSymbols 테마 그룹에서 제외된다.',
        '        items: [',
        itemLines,
        '        ],',
        '    },',
    ].join('\n');
    return `${content.slice(0, endAt)}${block}${content.slice(endAt)}`;
}

function insertIntoPopular(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    const declAt = content.indexOf(POPULAR_DECLARATION);
    if (declAt === -1) {
        throw new Error('POPULAR_TICKERS declaration not found');
    }
    const endAt = content.indexOf(POPULAR_END, declAt);
    if (endAt === -1) throw new Error('POPULAR_TICKERS end not found');

    const matches = [
        ...content.slice(declAt, endAt).matchAll(KR_POPULAR_LINE_RE),
    ];
    const last = matches.at(-1);
    if (last?.index === undefined) {
        throw new Error('KR block not found in POPULAR_TICKERS');
    }
    // KR 블록 뒤에 US Trending 섹션이 이어지므로 배열 끝이 아니라 마지막 KR 줄 뒤다.
    const insertAt = declAt + last.index + last[0].length;
    const lines = items
        .map(i => `\n    ${quote(i.symbol)}, // ${i.name}`)
        .join('');
    return `${content.slice(0, insertAt)}${lines}${content.slice(insertAt)}`;
}

export function insertKrTrendingItems(
    content: string,
    items: readonly KrTrendingItem[]
): string {
    if (!content.includes(CATEGORIES_DECLARATION)) {
        throw new Error('TICKER_CATEGORIES declaration not found');
    }
    const existing = extractExistingKrTickers(content);
    const fresh = items.filter(
        (item, i) =>
            !existing.has(item.symbol) &&
            items.findIndex(other => other.symbol === item.symbol) === i
    );
    if (fresh.length === 0) return content;
    return insertIntoPopular(insertIntoCategory(content, fresh), fresh);
}
