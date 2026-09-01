/**
 * 분석 탭 전반의 `plain` 배선 회귀.
 *
 * 각 탭의 `fetch*`는 SSE 봉투에서 `readPlain(result)`로 산문을 꺼내 상태에 싣는다.
 * 그 호출이 사라지거나 `plain: null`로 굳어도 탭별 기존 테스트는 전부 초록이었다
 * (리뷰 라운드 2 지적). 여기서 다섯 탭을 한 번에 고정한다 — 어느 한 탭에서
 * `readPlain` 호출을 지우면 이 파일이 깨진다.
 */
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { useFinancialsAnalysis } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import { useCongressTrend } from '@/widgets/congress/hooks/useCongressTrend';
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockStream = runAnalysisStream as Mock;
const PLAIN = '쉽게 쓴 분석문입니다.';

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return (
        <QueryClientProvider client={client}>
            <IntlTestProvider>{children}</IntlTestProvider>
        </QueryClientProvider>
    );
}

/** 각 탭의 훅을 최소 인자로 부르는 어댑터. 응답 shape는 탭마다 다르지만 봉투는 같다. */
const TABS: ReadonlyArray<{
    name: string;
    result: unknown;
    run: () => { status: string; plain?: string | null };
}> = [
    {
        name: 'news',
        result: { headlineKo: 'h', overallSentiment: 'neutral' },
        run: () =>
            useNewsAnalysis('AAPL', 'Apple', 'deepseek-v4-flash') as never,
    },
    {
        name: 'options',
        result: { commentary: 'c' },
        run: () =>
            useOptionsAnalysis({
                symbol: 'AAPL',
                companyName: 'Apple',
                expirationDate: '2026-09-18',
                modelId: 'deepseek-v4-flash',
            }) as never,
    },
    {
        name: 'financials',
        result: { overallSentiment: 'neutral', overallConclusionKo: 'c' },
        run: () => useFinancialsAnalysis('AAPL', 'deepseek-v4-flash') as never,
    },
    {
        name: 'congress',
        result: { overallSentiment: 'neutral', summaryKo: 's' },
        run: () => useCongressTrend('AAPL', 'deepseek-v4-flash') as never,
    },
    {
        name: 'fundamental',
        result: { overallSentiment: 'neutral', overallConclusionKo: 'c' },
        run: () => useFundamentalAnalysis('AAPL', 'deepseek-v4-flash') as never,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe('분석 탭 plain 배선', () => {
    for (const tab of TABS) {
        it(`${tab.name}: 봉투의 plain을 상태로 옮긴다`, async () => {
            mockStream.mockResolvedValue({
                status: 'cached',
                result: tab.result,
                plain: PLAIN,
            });

            const { result } = renderHook(tab.run, { wrapper });

            await waitFor(() => expect(result.current.status).toBe('done'));
            expect(result.current.plain).toBe(PLAIN);
        });

        it(`${tab.name}: plain이 없는 응답은 null로 떨어진다`, async () => {
            mockStream.mockResolvedValue({
                status: 'cached',
                result: tab.result,
            });

            const { result } = renderHook(tab.run, { wrapper });

            await waitFor(() => expect(result.current.status).toBe('done'));
            expect(result.current.plain).toBeNull();
        });
    }
});
