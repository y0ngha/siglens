import { describe, it, expect } from 'vitest';
import { buildCategoryPageTitle, buildCategoryPageDescription } from '../seo';
import { SEO_DESCRIPTION_MAX_LENGTH } from '@/shared/lib/seo';

describe('buildCategoryPageTitle', () => {
    it('koLabel을 포함한 제목을 반환한다', () => {
        const title = buildCategoryPageTitle('암호화폐');
        expect(title).toContain('암호화폐');
        expect(title).toContain('뉴스');
        // 어휘도 고정한다. 이 문자열은 `<title>`·`og:title`·JSON-LD WebPage name의
        // 단일 출처라, 여기만 옛 표기로 남으면 한 페이지에 두 어휘가 공존한다.
        expect(title).toContain('최신 시장 흐름');
    });

    it('빈 koLabel이어도 throw하지 않는다', () => {
        expect(() => buildCategoryPageTitle('')).not.toThrow();
        const title = buildCategoryPageTitle('');
        expect(typeof title).toBe('string');
    });
});

describe('buildCategoryPageDescription', () => {
    it('koLabel을 포함한 설명을 반환한다', () => {
        const desc = buildCategoryPageDescription('주식');
        expect(desc).toContain('주식');
    });

    it('반환 문자열 길이가 SEO_DESCRIPTION_MAX_LENGTH 이하다', () => {
        const desc = buildCategoryPageDescription('일반');
        expect([...desc].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('긴 koLabel이 포함돼도 설명이 SEO_DESCRIPTION_MAX_LENGTH를 초과하지 않는다', () => {
        const longLabel = '매우'.repeat(30);
        const desc = buildCategoryPageDescription(longLabel);
        expect([...desc].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('빈 koLabel이어도 throw하지 않는다', () => {
        expect(() => buildCategoryPageDescription('')).not.toThrow();
    });
});
