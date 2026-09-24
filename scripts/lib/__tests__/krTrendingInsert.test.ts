import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { insertKrTrendingItems } from '../krTrendingInsert';
import { extractExistingKrTickers } from '../visitCandidates';

const REAL = readFileSync(
    resolve(process.cwd(), 'src/shared/config/popular-tickers.ts'),
    'utf-8'
);

/** kr-trending 카테고리 블록의 심볼들. */
function trendingItems(content: string): string[] {
    const at = content.indexOf("id: 'kr-trending',");
    if (at === -1) return [];
    const end = content.indexOf('\n        ],', at);
    return [...content.slice(at, end).matchAll(/symbol: '([^']+)'/g)].map(
        m => m[1]!
    );
}

/**
 * 원문에서 `kr-trending` 카테고리 블록만 걷어낸다. 스크립트가 첫 KR 후보를 넣고 커밋하면
 * 실제 config에 이 블록이 생기므로, "카테고리가 없을 때"를 검증하는 테스트가 그 뒤에도
 * 실제 원문 위에서 돌도록 한다.
 */
function withoutKrTrendingCategory(content: string): string {
    const at = content.indexOf("\n    {\n        id: 'kr-trending',");
    if (at === -1) return content;
    const end = content.indexOf('\n    },', at) + '\n    },'.length;
    return content.slice(0, at) + content.slice(end);
}

/** 카테고리 블록이 없는 실제 원문. */
const BASE = withoutKrTrendingCategory(REAL);

// 형상만 맞고 상장될 일 없는 코드 — 실제 종목을 쓰면 스크립트가 그 종목을 넣은 뒤
// "이미 있음"으로 건너뛰어 테스트가 깨진다.
const ITEM_A = { symbol: '999990.KS', name: '가상종목A' };
const ITEM_B = { symbol: '999980.KQ', name: '가상종목B' };

describe('insertKrTrendingItems', () => {
    it('카테고리가 없으면 TICKER_CATEGORIES 끝에 만든다', () => {
        const out = insertKrTrendingItems(BASE, [ITEM_A]);
        expect(trendingItems(out)).toEqual(['999990.KS']);
        expect(out).toContain("label: '관심 급상승',");
        // 카테고리는 TICKER_CATEGORIES 배열 안, KR_CATEGORY_IDS 선언보다 앞이다.
        expect(out.indexOf("id: 'kr-trending',")).toBeLessThan(
            out.indexOf('export const KR_CATEGORY_IDS')
        );
    });

    it('POPULAR_TICKERS의 KR 블록 끝(US Trending 섹션 앞)에 넣는다', () => {
        const out = insertKrTrendingItems(REAL, [ITEM_A]);
        const lastKr = out.indexOf("'403870.KQ', // HPSP");
        const inserted = out.indexOf("'999990.KS', // 가상종목A");
        const nextTrending = out.indexOf('// --- Trending', lastKr);
        expect(inserted).toBeGreaterThan(lastKr);
        expect(nextTrending === -1 || inserted < nextTrending).toBe(true);
    });

    it('KR 합집합 불변식 — 카테고리 KR 심볼 전체 = POPULAR_TICKERS KR 블록', () => {
        const out = insertKrTrendingItems(REAL, [ITEM_A, ITEM_B]);
        const categoryPart = out.slice(
            out.indexOf('export const TICKER_CATEGORIES'),
            out.indexOf('export const KR_CATEGORY_IDS')
        );
        const categoryKr = new Set(
            [...categoryPart.matchAll(/symbol: '(\d{6}\.K[SQ])'/g)].map(
                m => m[1]!
            )
        );
        expect([...categoryKr].sort()).toEqual(
            [...extractExistingKrTickers(out)].sort()
        );
    });

    it('카테고리가 이미 있으면 items 끝에 덧붙인다 (블록을 새로 만들지 않는다)', () => {
        const once = insertKrTrendingItems(BASE, [ITEM_A]);
        const twice = insertKrTrendingItems(once, [ITEM_B]);
        expect(trendingItems(twice)).toEqual(['999990.KS', '999980.KQ']);
        expect(twice.split("id: 'kr-trending',")).toHaveLength(2);
    });

    it('이미 있는 심볼은 건너뛴다 (멱등)', () => {
        const once = insertKrTrendingItems(REAL, [ITEM_A]);
        expect(insertKrTrendingItems(once, [ITEM_A])).toBe(once);
        // 기존 KR 블록 종목도 마찬가지.
        expect(
            insertKrTrendingItems(REAL, [
                { symbol: '005930.KS', name: '삼성전자' },
            ])
        ).toBe(REAL);
    });

    it('이름의 작은따옴표를 이스케이프한다', () => {
        const out = insertKrTrendingItems(REAL, [
            { symbol: '999990.KS', name: "O'Brien" },
        ]);
        expect(out).toContain("name: 'O\\'Brien'");
    });

    it('앵커가 없으면 던진다', () => {
        expect(() => insertKrTrendingItems('const x = 1;', [ITEM_A])).toThrow(
            /TICKER_CATEGORIES/
        );
    });
});
