/**
 * 실제 `useOptionsAnalysis`와 `useAiRunPermission`을 함께 돌려, 공유 트리거와 숨긴 위젯이 만드는
 * 요청이 캐시 전용인지 생성인지를 스트림 호출 인자로 검증한다.
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
vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Mock } from 'vitest';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import { OptionsAiAnalysis } from '@/widgets/options/OptionsAiAnalysis';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import {
    ShareableAnalysisProvider,
    useShareable,
} from '@/features/share/model/ShareableAnalysisContext';

const mockStream = runAnalysisStream as Mock;

const RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish options flow',
    perExpiration: [],
    signals: [],
    analyzedAt: '2025-01-15T10:00:00Z',
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
                <OptionsAiAnalysis
                    symbol="AAPL"
                    companyName="Apple"
                    expirationDate="all"
                    modelId="gemini-3.5-flash-lite"
                    reasoning={false}
                    isSettingsHydrated
                    hideView={hideView}
                />
                <TriggerProbe />
            </ShareableAnalysisProvider>
        </QueryClientProvider>
    );
}

function streamParams() {
    return mockStream.mock.calls.map(
        ([arg]) => arg.params as { cacheOnly?: boolean }
    );
}

describe('OptionsAiAnalysis — 실행 권한', () => {
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

    it('대기 중 헤더 공유 트리거가 생성을 여는 grant를 부른다', async () => {
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
        expect(streamParams()[0].cacheOnly).toBe(true);

        act(() => captured.trigger?.());

        expect(mockGrant).toHaveBeenCalledTimes(1);
    });

    it('숨긴 위젯은 자동 실행이 허용돼도 캐시만 읽고, 공유 트리거가 생성을 시작한다', async () => {
        mockUseAiAutoRunAllowed.mockReturnValue({
            allowed: true,
            grant: mockGrant,
        });
        renderWidget(true);

        await waitFor(() => expect(mockStream).toHaveBeenCalledTimes(1));
        expect(streamParams()[0].cacheOnly).toBe(true);
        await waitFor(() => expect(captured.trigger).toBeDefined());
        await act(async () => {});

        act(() => captured.trigger?.());

        await waitFor(() => expect(mockStream).toHaveBeenCalledTimes(2));
        expect(streamParams()[1].cacheOnly).toBeFalsy();
        expect(mockGrant).not.toHaveBeenCalled();
    });
});
