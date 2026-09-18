import { describe, it, expect, beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { buildCategoryPageTitle, buildCategoryPageDescription } from '../seo';
import {
    SEO_DESCRIPTION_MAX_LENGTH,
    type SeoTranslator,
} from '@/shared/lib/seo';

// `t`는 이제 필수 인자다(§design SeoTranslator required-param). ko로 고정한
// 실제 번역자를 한 번 만들어 재사용한다 — 카탈로그 키 존재 자체도 함께 검증된다.
let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

describe('buildCategoryPageTitle', () => {
    it('label을 포함한 제목을 반환한다', () => {
        const title = buildCategoryPageTitle('암호화폐', t);
        expect(title).toContain('암호화폐');
        expect(title).toContain('뉴스');
        // 어휘도 고정한다. 이 문자열은 `<title>`·`og:title`·JSON-LD WebPage name의
        // 단일 출처라, 여기만 옛 표기로 남으면 한 페이지에 두 어휘가 공존한다.
        expect(title).toContain('최신 흐름');
    });

    it('빈 label이어도 throw하지 않는다', () => {
        expect(() => buildCategoryPageTitle('', t)).not.toThrow();
        const title = buildCategoryPageTitle('', t);
        expect(typeof title).toBe('string');
    });
});

describe('buildCategoryPageDescription', () => {
    it('label을 포함한 설명을 반환한다', () => {
        const desc = buildCategoryPageDescription('주식', t);
        expect(desc).toContain('주식');
    });

    it('반환 문자열 길이가 SEO_DESCRIPTION_MAX_LENGTH 이하다', () => {
        const desc = buildCategoryPageDescription('일반', t);
        expect([...desc].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('긴 label이 포함돼도 설명이 SEO_DESCRIPTION_MAX_LENGTH를 초과하지 않는다', () => {
        const longLabel = '매우'.repeat(30);
        const desc = buildCategoryPageDescription(longLabel, t);
        expect([...desc].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('빈 label이어도 throw하지 않는다', () => {
        expect(() => buildCategoryPageDescription('', t)).not.toThrow();
    });

    /**
     * **카테고리마다 설명이 달라야 한다.** 예전에는 템플릿 하나에 라벨만 갈아 끼워서
     * 색인 대상 5개의 설명이 사실상 같았다(2026-09-18 운영 실측). 앞머리를 카테고리
     * 고유 소개 문장으로 바꾼 것이 이 변경의 전부이므로, 되돌아가면 여기서 깨진다.
     */
    it('카테고리 소개가 다르면 설명도 서로 다르다', async () => {
        const tRoot = await getTranslations({ locale: 'ko' });
        const { CATEGORY_CONFIG } = await import('@/entities/market-news');

        // 설정 전체를 훑는다 — 카테고리가 늘면 그 설명도 자동으로 검사 대상이 된다.
        const descriptions = Object.values(CATEGORY_CONFIG).map(cfg =>
            buildCategoryPageDescription(tRoot(cfg.descriptionKey), t)
        );

        expect(descriptions.length).toBeGreaterThan(1);
        expect(new Set(descriptions).size).toBe(descriptions.length);
        // 공통 꼬리표는 그대로 붙는다 — 차별화는 앞머리로만 한다.
        for (const desc of descriptions) {
            expect(desc).toContain('AI');
        }
    });
});
