import { deriveLabel } from '@/domain/chat/derivePageContextLabel';

describe('deriveLabel', () => {
    describe('symbol base page', () => {
        it('/AAPL → 차트 분석', () => {
            expect(deriveLabel('/AAPL')).toBe('차트 분석');
        });

        it('/BRK.A → 차트 분석 (dot in symbol)', () => {
            expect(deriveLabel('/BRK.A')).toBe('차트 분석');
        });

        it('lowercase /aapl → 차트 분석 (case-insensitive)', () => {
            expect(deriveLabel('/aapl')).toBe('차트 분석');
        });
    });

    describe('sub-pages', () => {
        it('/AAPL/fundamental → 펀더멘털 분석', () => {
            expect(deriveLabel('/AAPL/fundamental')).toBe('펀더멘털 분석');
        });

        it('/AAPL/news → 뉴스 분석', () => {
            expect(deriveLabel('/AAPL/news')).toBe('뉴스 분석');
        });

        it('/AAPL/overall → AI 종합 분석', () => {
            expect(deriveLabel('/AAPL/overall')).toBe('AI 종합 분석');
        });

        it('/AAPL/fear-greed → 공포 탐욕 지수', () => {
            expect(deriveLabel('/AAPL/fear-greed')).toBe('공포 탐욕 지수');
        });

        it('case-insensitive sub-page /AAPL/FUNDAMENTAL → 펀더멘털 분석', () => {
            expect(deriveLabel('/AAPL/FUNDAMENTAL')).toBe('펀더멘털 분석');
        });
    });

    describe('non-symbol pages', () => {
        it('/account → null', () => {
            expect(deriveLabel('/account')).toBeNull();
        });

        it('/dashboard → null', () => {
            expect(deriveLabel('/dashboard')).toBeNull();
        });

        it('/ (root) → null', () => {
            expect(deriveLabel('/')).toBeNull();
        });

        it('/AAPL/unknown-subpage → null (unrecognized sub-page)', () => {
            expect(deriveLabel('/AAPL/unknown-subpage')).toBeNull();
        });

        it('/AVERYLONGSYMBOL (>8 chars) → null', () => {
            expect(deriveLabel('/AVERYLONGSYMBOL')).toBeNull();
        });
    });
});
