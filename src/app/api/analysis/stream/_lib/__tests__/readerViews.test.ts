import { getTranslations } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rewriteToPlainLanguage } from '@/entities/analysis-plain/api';
import {
    resolveCurrentPrice,
    resolvePriceAsOf,
} from '@/entities/analysis-plain/lib/currentPrice';
import { withReaderViews } from '../readerViews';

vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/entities/analysis-plain/api', () => ({
    rewriteToPlainLanguage: vi.fn(),
}));
vi.mock('@/entities/analysis-plain/lib/currentPrice', () => ({
    resolveCurrentPrice: vi.fn(),
    resolvePriceAsOf: vi.fn(),
}));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    currencyForSymbol: () => 'USD',
}));

describe('withReaderViews', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getTranslations).mockResolvedValue(
            ((key: string) => `t:${key}`) as never
        );
        vi.mocked(rewriteToPlainLanguage).mockResolvedValue('쉬운 설명');
        vi.mocked(resolveCurrentPrice).mockResolvedValue(101);
        vi.mocked(resolvePriceAsOf).mockResolvedValue('asOf' as never);
    });

    describe('평이화', () => {
        it('평이화 대상 종류는 plain 필드를 붙인다', async () => {
            const out = await withReaderViews(
                Promise.resolve({ status: 'done', result: { a: 1 } }),
                'ko',
                'technical',
                'AAPL'
            );
            expect(out).toEqual({
                status: 'done',
                result: { a: 1 },
                plain: '쉬운 설명',
            });
        });

        it('봉투가 아니라 분석 payload를 평이화에 넘긴다', async () => {
            await withReaderViews(
                Promise.resolve({ status: 'done', result: { a: 1 } }),
                'ko',
                'technical',
                'AAPL'
            );
            expect(rewriteToPlainLanguage).toHaveBeenCalledWith(
                { a: 1 },
                'AAPL',
                'ko',
                'USD',
                101,
                'asOf'
            );
        });

        it('result 필드가 없으면 봉투 자체를 payload로 넘긴다', async () => {
            const envelope = { status: 'cached', headline: 'h' };
            await withReaderViews(
                Promise.resolve(envelope),
                'ko',
                'news',
                'AAPL'
            );
            expect(rewriteToPlainLanguage).toHaveBeenCalledWith(
                envelope,
                'AAPL',
                'ko',
                'USD',
                101,
                'asOf'
            );
        });

        it('평이화 결과가 null이면 plain을 null로 둔다', async () => {
            vi.mocked(rewriteToPlainLanguage).mockResolvedValue(null);
            const out = await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                'overall',
                'AAPL'
            );
            expect(out).toEqual({ status: 'done', result: {}, plain: null });
        });

        it('에러 봉투는 평이화하지 않고 plain 필드만 null로 붙인다', async () => {
            const out = await withReaderViews(
                Promise.resolve({
                    status: 'error',
                    error: { code: 'x', message: 'm' },
                }),
                'ko',
                'technical',
                'AAPL'
            );
            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
            expect(out).toEqual({
                status: 'error',
                error: { code: 'x', message: 'm' },
                plain: null,
            });
        });

        it('평이화가 예기치 않게 throw해도 분석 결과를 지키고 plain을 null로 둔다', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            vi.mocked(rewriteToPlainLanguage).mockRejectedValue(
                new Error('contract broken')
            );
            const out = await withReaderViews(
                Promise.resolve({ status: 'done', result: { a: 1 } }),
                'ko',
                'technical',
                'AAPL'
            );
            expect(out).toEqual({
                status: 'done',
                result: { a: 1 },
                plain: null,
            });
            expect(spy).toHaveBeenCalledWith(
                '[withPlainLanguage] unexpected throw',
                expect.any(Error)
            );
            spy.mockRestore();
        });
    });

    describe('평이화 대상 판정', () => {
        it('토글이 없는 종류는 평이화하지 않고 plain 필드도 붙이지 않는다', async () => {
            const out = await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                'briefing',
                'AAPL'
            );
            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
            expect(out).toEqual({ status: 'done', result: {} });
        });

        it('심볼이 없으면 평이화하지 않는다', async () => {
            const out = await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                'technical',
                undefined
            );
            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
            expect(out).toEqual({ status: 'done', result: {} });
        });

        it('빈 문자열 심볼은 평이화하지 않는다', async () => {
            await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                'technical',
                ''
            );
            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });

        it.each([
            'overall',
            'news',
            'fundamental',
            'financials',
            'options',
            'congress',
        ] as const)('%s 종류는 평이화한다', async type => {
            await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                type,
                'AAPL'
            );
            expect(rewriteToPlainLanguage).toHaveBeenCalledTimes(1);
        });

        it.each([
            'briefing',
            'macroBriefing',
            'marketNewsDigest',
            'investorFlows',
        ] as const)('%s 종류는 평이화하지 않는다', async type => {
            await withReaderViews(
                Promise.resolve({ status: 'done', result: {} }),
                'ko',
                type,
                'AAPL'
            );
            expect(rewriteToPlainLanguage).not.toHaveBeenCalled();
        });
    });

    describe('게이트 문구 현지화', () => {
        const gateError = (
            code: string
        ): { status: string; error: unknown } => ({
            status: 'error',
            error: { code, message: 'English from core' },
        });

        it('timeframe_not_allowed 문구를 요청 로케일 카탈로그로 바꾼다', async () => {
            const out = await withReaderViews(
                Promise.resolve(gateError('timeframe_not_allowed')),
                'ja',
                'technical',
                'AAPL'
            );
            expect(getTranslations).toHaveBeenCalledWith({
                locale: 'ja',
                namespace: 'app.api.stream',
            });
            expect(out).toEqual({
                status: 'error',
                error: {
                    code: 'timeframe_not_allowed',
                    message: 't:timeframeNotAllowed',
                },
                plain: null,
            });
        });

        it('다른 에러 코드의 문구는 건드리지 않는다', async () => {
            const out = await withReaderViews(
                Promise.resolve(gateError('other')),
                'ja',
                'briefing',
                undefined
            );
            expect(getTranslations).not.toHaveBeenCalled();
            expect(out).toEqual(gateError('other'));
        });

        it('error 봉투에 error 필드가 없어도 그대로 통과한다', async () => {
            const out = await withReaderViews(
                Promise.resolve({ status: 'error' }),
                'ko',
                'briefing',
                undefined
            );
            expect(out).toEqual({ status: 'error' });
        });

        it('에러가 아닌 객체는 번역 카탈로그를 읽지 않는다', async () => {
            await withReaderViews(
                Promise.resolve({ status: 'done' }),
                'ko',
                'briefing',
                undefined
            );
            expect(getTranslations).not.toHaveBeenCalled();
        });

        it('작업이 reject하면 그대로 reject한다', async () => {
            const failure = new Error('boom');
            await expect(
                withReaderViews(
                    Promise.reject(failure),
                    'ko',
                    'technical',
                    'AAPL'
                )
            ).rejects.toBe(failure);
        });
    });
});
