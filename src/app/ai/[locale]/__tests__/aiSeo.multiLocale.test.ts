import { describe, expect, it, vi } from 'vitest';

/**
 * `STATIC_INDEXABLE_LOCALES`는 현재 운영값이 `['ko']`(길이 1)이라 `buildAiPageMetadata`의
 * `languages` hreflang 맵 조립 분기(`length > 1`)가 실제 설정으로는 절대 실행되지 않는다.
 * 번역 레이어가 배포돼 이 상수가 늘어나는 순간을 대비해, 그 분기 자체가 맞는 hreflang
 * 맵과 `x-default`를 만드는지 여기서 독립적으로 검증한다(별도 파일 — 모듈 mock은
 * 파일 전체에 적용되므로 기존 단일-로케일 테스트와 격리한다).
 */
vi.mock('@/shared/i18n/indexableLocales', () => ({
    STATIC_INDEXABLE_LOCALES: ['ko', 'en'] as const,
    SYMBOL_INDEXABLE_LOCALES: ['ko'] as const,
}));

const { buildAiHomeMetadata } = await import('@/app/ai/[locale]/aiSeo');
const { AI_SITE_URL } = await import('@/shared/config/aiHost');

const copy = {
    title: 'title',
    description: 'description',
    ogLabel: 'label',
};

describe('buildAiHomeMetadata — 복수 색인 로케일(가정)', () => {
    it('색인 가능 로케일이 둘 이상이면 hreflang 맵과 x-default를 채운다', () => {
        const m = buildAiHomeMetadata('ko', copy);

        expect(m.alternates?.languages).toEqual({
            ko: `${AI_SITE_URL}/`,
            en: `${AI_SITE_URL}/en`,
            'x-default': `${AI_SITE_URL}/`,
        });
    });

    it('색인 불가 로케일(ja)은 hreflang 맵에서 빠진다', () => {
        const m = buildAiHomeMetadata('ko', copy);
        const languages = m.alternates?.languages as Record<string, string>;
        expect(languages).not.toHaveProperty('ja');
        expect(languages).not.toHaveProperty('zh');
    });
});
