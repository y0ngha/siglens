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
});
