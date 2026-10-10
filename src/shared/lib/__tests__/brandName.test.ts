import { describe, expect, it } from 'vitest';
import { brandAiName, brandName, brandTitle } from '@/shared/lib/brandName';
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

describe('brandAiName', () => {
    it('ko는 시그렌즈 AI, 다른 로케일은 SIGLENS AI', () => {
        expect(brandAiName('ko')).toBe('시그렌즈 AI');
        for (const locale of ['en', 'ja', 'zh'] as const) {
            expect(brandAiName(locale)).toBe('SIGLENS AI');
        }
    });
});

describe('brandTitle', () => {
    it('ko 제목 접미사는 | 시그렌즈다', () => {
        expect(brandTitle('차트 가이드', 'ko')).toBe('차트 가이드 | 시그렌즈');
    });

    it('ko 외 로케일의 제목 접미사는 | SIGLENS다', () => {
        for (const locale of ['en', 'ja', 'zh'] as const) {
            expect(brandTitle('Chart guide', locale)).toBe(
                'Chart guide | SIGLENS'
            );
        }
    });

    it('로케일을 모르면 기본 로케일(ko) 접미사를 쓴다', () => {
        expect(brandTitle('차트 가이드')).toBe('차트 가이드 | 시그렌즈');
    });

    it('루트 레이아웃 template 자리표시자도 같은 규칙을 따른다', () => {
        expect(brandTitle('%s', 'ko')).toBe('%s | 시그렌즈');
        expect(brandTitle('%s', 'en')).toBe('%s | SIGLENS');
    });
});
