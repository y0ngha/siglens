import { describe, expect, it } from 'vitest';
import { brandName } from '@/shared/lib/brandName';
import { SITE_NAME, SITE_NAME_KO } from '@/shared/lib/seo';

describe('brandName', () => {
    it('ko는 한글 표기를 돌려준다', () => {
        expect(brandName('ko')).toBe(SITE_NAME_KO);
        expect(brandName('ko')).toBe('시그렌즈');
    });

    it('다른 로케일은 영문 표기를 돌려준다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            expect(brandName(locale)).toBe(SITE_NAME);
        }
        expect(SITE_NAME).toBe('SIGLENS');
    });
});
