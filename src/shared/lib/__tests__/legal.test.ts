import {
    INVESTMENT_DISCLAIMER,
    PRIVACY_PATH,
    TERMS_PATH,
    PRIVACY_TITLE,
    PRIVACY_FULL_TITLE,
    PRIVACY_DESCRIPTION,
    TERMS_TITLE,
    TERMS_FULL_TITLE,
    TERMS_DESCRIPTION,
    formatKoreanDate,
} from '@/shared/lib/legal';
import { SITE_NAME } from '@/shared/lib/seo';

describe('legal constants', () => {
    it('INVESTMENT_DISCLAIMER is a non-empty Korean string', () => {
        expect(INVESTMENT_DISCLAIMER.length).toBeGreaterThan(0);
        expect(INVESTMENT_DISCLAIMER).toContain('투자');
    });

    it('PRIVACY_PATH is /privacy', () => {
        expect(PRIVACY_PATH).toBe('/privacy');
    });

    it('TERMS_PATH is /terms', () => {
        expect(TERMS_PATH).toBe('/terms');
    });

    it('PRIVACY_TITLE is Korean privacy title', () => {
        expect(PRIVACY_TITLE).toBe('개인정보처리방침');
    });

    it('PRIVACY_FULL_TITLE includes site name', () => {
        expect(PRIVACY_FULL_TITLE).toBe(`${PRIVACY_TITLE} | ${SITE_NAME}`);
    });

    it('PRIVACY_DESCRIPTION includes site name', () => {
        expect(PRIVACY_DESCRIPTION).toContain(SITE_NAME);
    });

    it('TERMS_TITLE is Korean terms title', () => {
        expect(TERMS_TITLE).toBe('이용약관');
    });

    it('TERMS_FULL_TITLE includes site name', () => {
        expect(TERMS_FULL_TITLE).toBe(`${TERMS_TITLE} | ${SITE_NAME}`);
    });

    it('TERMS_DESCRIPTION includes site name', () => {
        expect(TERMS_DESCRIPTION).toContain(SITE_NAME);
    });
});

describe('formatKoreanDate', () => {
    it('formats a date in Korean format (YYYY년 M월 D일)', () => {
        // Use a fixed UTC date, the formatter uses Asia/Seoul timezone
        const date = new Date('2024-03-15T00:00:00Z');
        const result = formatKoreanDate(date);
        // In KST (UTC+9), this is March 15
        expect(result).toMatch(/2024년 3월 15일/);
    });

    it('handles year boundaries correctly', () => {
        // Dec 31 UTC might be Jan 1 KST
        const date = new Date('2024-12-31T20:00:00Z');
        const result = formatKoreanDate(date);
        // UTC 20:00 = KST 05:00 next day → Jan 1, 2025
        expect(result).toMatch(/2025년 1월 1일/);
    });

    it('returns a string', () => {
        expect(typeof formatKoreanDate(new Date())).toBe('string');
    });
});
