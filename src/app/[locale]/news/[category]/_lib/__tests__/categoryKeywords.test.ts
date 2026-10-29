import { describe, expect, it } from 'vitest';
import { buildCategoryKeywords } from '@/app/[locale]/news/[category]/_lib/categoryKeywords';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';

describe('buildCategoryKeywords', () => {
    it('카테고리 라벨 키워드와 공통 키워드를 싣는다', () => {
        const cfg = CATEGORY_CONFIG.stock;

        expect(buildCategoryKeywords(cfg)).toEqual(
            expect.arrayContaining([
                `${cfg.koLabel} 뉴스`,
                `${cfg.koLabel} 최신 뉴스`,
                `${cfg.koLabel} 뉴스 분석`,
                '시장 뉴스 한국어',
                'AI 뉴스 다이제스트',
            ])
        );
    });

    it('미국 카테고리는 옛 표기 키워드까지 싣는다', () => {
        expect(buildCategoryKeywords(CATEGORY_CONFIG.stock)).toEqual(
            expect.arrayContaining(['미국 시장 뉴스', '미국 마켓 뉴스'])
        );
    });

    it('한국 카테고리에는 미국 지역 키워드를 붙이지 않는다', () => {
        const keywords = buildCategoryKeywords(CATEGORY_CONFIG.kr);

        expect(keywords).toEqual(expect.arrayContaining(['코스피 뉴스']));
        expect(keywords).not.toContain('미국 시장 뉴스');
    });
});
