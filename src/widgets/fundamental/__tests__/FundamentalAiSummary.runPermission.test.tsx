/**
 * 실제 `useFundamentalAnalysis`와 `useAiRunPermission`을 함께 돌려, 공유 트리거와 숨김 위젯이
 * 만드는 요청이 캐시 전용인지 생성인지를 스트림 호출 인자로 검증한다.
 */
const { mockUseAiAutoRunAllowed, mockGrant } = vi.hoisted(() => {
    const grant = vi.fn();
    return {
        mockGrant: grant,
        mockUseAiAutoRunAllowed: vi.fn(() => ({ allowed: true, grant })),
    };
});
vi.mock('@/features/symbol-model/hooks/useAiAutoRunAllowed', () => ({
    useAiAutoRunAllowed: mockUseAiAutoRunAllowed,
}));
vi.mock('@/features/symbol-model/hooks/useDefaultModelId', () => ({
    useDefaultModelId: () => 'gemini-3.5-flash-lite',
}));
vi.mock('@/features/symbol-model/hooks/useAnalysisSettingsHydrated', () => ({
    useAnalysisSettingsHydrated: () => true,
}));
vi.mock('@/features/symbol-model/hooks/useDefaultReasoning', () => ({
    useDefaultReasoning: () => false,
}));
vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

import { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import { FundamentalAiSummary } from '../FundamentalAiSummary';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import {
    ShareableAnalysisProvider,
    useShareable,
} from '@/features/share/model/ShareableAnalysisContext';

const mockStream = runAnalysisStream as Mock;

const RESULT: FundamentalAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '펀더멘털이 양호합니다',
    categoryAssessments: [],
    riskFactorsKo: [],
};

const captured: { trigger?: () => void } = {};

function TriggerProbe() {
    const trigger = useShareable()?.trigger;
    useEffect(() => {
        captured.trigger = trigger;
    });
    return null;
}

function renderWidget(hideView: boolean) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={client}>
            <ShareableAnalysisProvider>
                <FundamentalAiSummary symbol="AAPL" hideView={hideView} />
                <TriggerProbe />
            </ShareableAnalysisProvider>
        </QueryClientProvider>
    );
}

/** 지금까지의 스트림 요청 중 캐시 전용(`cacheOnly: true`)과 생성 요청의 개수. */
function requestCounts() {
    const params = mockStream.mock.calls.map(
        ([arg]) => arg.params as { cacheOnly?: boolean }
    );
    return {
        cacheOnly: params.filter(p => p.cacheOnly === true).length,
        generate: params.filter(p => p.cacheOnly !== true).length,
    };
}

describe('FundamentalAiSummary — 실행 권한', () => {
    beforeEach(() => {
        captured.trigger = undefined;
        mockStream.mockReset();
        mockGrant.mockReset();
        // 캐시 전용 요청은 미스, 일반 요청은 생성 결과.
        mockStream.mockImplementation(async ({ params }) =>
            params.cacheOnly
                ? { status: 'miss_no_trigger' }
                : { status: 'done', result: RESULT }
        );
    });

    it('대기 중 헤더 공유 트리거가 게이트를 연다', async () => {
        mockUseAiAutoRunAllowed.mockReturnValue({
            allowed: false,
            grant: mockGrant,
        });
        renderWidget(false);

        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /AI 분석 시작/ })
            ).toBeInTheDocument()
        );
        expect(requestCounts()).toEqual({ cacheOnly: 1, generate: 0 });

        act(() => captured.trigger?.());

        // 보이는 위젯의 start는 grant — 캐시 전용 재조회가 아니라 게이트가 열린다.
        expect(mockGrant).toHaveBeenCalledTimes(1);
        expect(mockStream).toHaveBeenCalledTimes(1);
    });

    it('숨긴 위젯은 자동 실행이 허용돼도 캐시만 읽고, 공유 트리거가 생성을 시작한다', async () => {
        mockUseAiAutoRunAllowed.mockReturnValue({
            allowed: true,
            grant: mockGrant,
        });
        renderWidget(true);

        await waitFor(() => expect(mockStream).toHaveBeenCalledTimes(1));
        expect(requestCounts()).toEqual({ cacheOnly: 1, generate: 0 });
        // 미스가 반영돼 awaiting 상태가 된 뒤에야 트리거가 start를 가리킨다.
        await waitFor(() => expect(captured.trigger).toBeDefined());
        await act(async () => {});

        act(() => captured.trigger?.());

        await waitFor(() => expect(mockStream).toHaveBeenCalledTimes(2));
        expect(requestCounts()).toEqual({ cacheOnly: 1, generate: 1 });
        expect(mockGrant).not.toHaveBeenCalled();
    });
});
