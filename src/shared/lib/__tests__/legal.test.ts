import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import {
    INVESTMENT_DISCLAIMER_KEY,
    PRIVACY_PATH,
    TERMS_PATH,
    privacyTitle,
    privacyFullTitle,
    privacyDescription,
    termsTitle,
    termsFullTitle,
    termsDescription,
    formatKoreanDate,
} from '@/shared/lib/legal';
import { SITE_NAME, type SeoTranslator } from '@/shared/lib/seo';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

// title/description은 이제 `shared.seo` 카탈로그 번역자를 받는 함수다
// (§design SeoTranslator required-param). ko로 고정한 실제 번역자를 재사용한다.
let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

describe('legal constants', () => {
    /**
     * 고지 문구는 이제 `shared.lib.legal` 카탈로그가 소유한다 — 예전엔 모듈
     * 상수라 푸터·공유 페이지·약관·개인정보처리방침 네 곳 전부가 로케일과
     * 무관하게 한국어 고지를 렌더했다. ko 문구를 고정하는 대신 키가 네
     * 로케일에 다 있는지, 비-ko에 한글이 남지 않는지를 본다.
     */
    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        '%s: 투자 고지 문구가 있다',
        locale => {
            const value = catalogTranslator(
                'shared.lib.legal',
                locale
            )(INVESTMENT_DISCLAIMER_KEY);
            expect(value.length).toBeGreaterThan(0);
            if (locale === 'ko') {
                expect(value).toContain('투자');
            } else {
                expect(value).not.toMatch(/[가-힣]/);
            }
        }
    );

    it('PRIVACY_PATH is /privacy', () => {
        expect(PRIVACY_PATH).toBe('/privacy');
    });

    it('TERMS_PATH is /terms', () => {
        expect(TERMS_PATH).toBe('/terms');
    });

    it('privacyTitle(t) is Korean privacy title', () => {
        expect(privacyTitle(t)).toBe('개인정보처리방침');
    });

    it('privacyFullTitle(t) includes site name', () => {
        expect(privacyFullTitle(t)).toBe(`${privacyTitle(t)} | ${SITE_NAME}`);
    });

    it('privacyDescription(t) includes site name', () => {
        expect(privacyDescription(t)).toContain(SITE_NAME);
    });

    it('termsTitle(t) is Korean terms title', () => {
        expect(termsTitle(t)).toBe('이용약관');
    });

    it('termsFullTitle(t) includes site name', () => {
        expect(termsFullTitle(t)).toBe(`${termsTitle(t)} | ${SITE_NAME}`);
    });

    it('termsDescription(t) includes site name', () => {
        expect(termsDescription(t)).toContain(SITE_NAME);
    });
});

describe('formatKoreanDate', () => {
    it('formats a date in Korean format (YYYY년 M월 D일) for locale=ko', () => {
        // Use a fixed UTC date, the formatter uses Asia/Seoul timezone
        const date = new Date('2024-03-15T00:00:00Z');
        const result = formatKoreanDate(date, 'ko');
        // In KST (UTC+9), this is March 15
        expect(result).toMatch(/2024년 3월 15일/);
    });

    it('handles year boundaries correctly', () => {
        // Dec 31 UTC might be Jan 1 KST
        const date = new Date('2024-12-31T20:00:00Z');
        const result = formatKoreanDate(date, 'ko');
        // UTC 20:00 = KST 05:00 next day → Jan 1, 2025
        expect(result).toMatch(/2025년 1월 1일/);
    });

    it('returns a string', () => {
        expect(typeof formatKoreanDate(new Date(), 'ko')).toBe('string');
    });

    // 회귀 가드: `Intl.DateTimeFormat('ko-KR')` 고정이 돌아오면
    // `/en/terms`·`/en/privacy`의 Effective Date가 다시 한국어로 샌다.
    it('locale=en에서는 한글이 섞이지 않는다', () => {
        const date = new Date('2024-03-15T00:00:00Z');
        const result = formatKoreanDate(date, 'en');
        expect(result).not.toMatch(/[가-힣]/);
        expect(result).toMatch(/March 15, 2024/);
    });
});
