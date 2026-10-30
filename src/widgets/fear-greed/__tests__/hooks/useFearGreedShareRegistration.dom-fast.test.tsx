import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    ShareableAnalysisProvider,
    useShareable,
} from '@/features/share/model/ShareableAnalysisContext';
import { useFearGreedShareRegistration } from '../../hooks/useFearGreedShareRegistration';

const SNAPSHOT: FearGreedSnapshot = {
    score: 58,
    label: 'GREED',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [],
};

interface Props {
    snapshot: FearGreedSnapshot | null;
    dataUpdatedAt: number;
    displayName?: string;
}

function wrapper({ children }: { children: ReactNode }) {
    return <ShareableAnalysisProvider>{children}</ShareableAnalysisProvider>;
}

/** 등록 훅을 돌리고, 헤더 공유 버튼이 읽는 값(`useShareable`)을 그대로 돌려준다. */
function renderRegistration(initialProps: Props) {
    return renderHook(
        ({ snapshot, dataUpdatedAt, displayName }: Props) => {
            useFearGreedShareRegistration({
                symbol: 'AAPL',
                displayName,
                snapshot,
                dataUpdatedAt,
            });
            return useShareable();
        },
        { wrapper, initialProps }
    );
}

describe('useFearGreedShareRegistration', () => {
    it('스냅샷을 받은 시각을 ISO analyzedAt으로 싣는다', () => {
        const { result } = renderRegistration({
            snapshot: SNAPSHOT,
            dataUpdatedAt: Date.UTC(2026, 9, 2, 20),
            displayName: 'Apple Inc.',
        });
        expect(result.current).toMatchObject({
            kind: 'fear-greed',
            status: 'success',
            result: SNAPSHOT,
            context: {
                symbol: 'AAPL',
                displayName: 'Apple Inc.',
                analyzedAt: '2026-10-02T20:00:00.000Z',
            },
        });
    });

    it('표시명이 없으면 심볼로 대신한다', () => {
        const { result } = renderRegistration({
            snapshot: SNAPSHOT,
            dataUpdatedAt: Date.UTC(2026, 9, 2, 20),
        });
        expect(result.current?.context.displayName).toBe('AAPL');
    });

    it('dataUpdatedAt이 바뀌면 새 analyzedAt으로 다시 등록한다', () => {
        const { result, rerender } = renderRegistration({
            snapshot: SNAPSHOT,
            dataUpdatedAt: Date.UTC(2026, 9, 2, 20),
        });
        const refreshed: FearGreedSnapshot = { ...SNAPSHOT, score: 61 };
        rerender({
            snapshot: refreshed,
            dataUpdatedAt: Date.UTC(2026, 9, 3, 20),
        });
        expect(result.current?.context.analyzedAt).toBe(
            '2026-10-03T20:00:00.000Z'
        );
        expect(result.current?.result).toEqual(refreshed);
    });

    /**
     * 봉이 없는 seed는 받은 시각이 `0`이고 core도 스냅샷을 내지 못한다. 공유는 불가로
     * 등록되고, 1970-01-01을 분석 시각으로 싣지 않는다.
     */
    it('봉이 없어 스냅샷도 시각도 없으면 analyzedAt 없이 unavailable로 등록한다', () => {
        const { result } = renderRegistration({
            snapshot: null,
            dataUpdatedAt: 0,
        });
        expect(result.current?.status).toBe('unavailable');
        expect(result.current?.result).toBeNull();
        expect(result.current?.context).not.toHaveProperty(
            'analyzedAt',
            expect.anything()
        );
    });

    it('스냅샷이 있어도 받은 시각이 0이면 analyzedAt을 싣지 않는다', () => {
        const { result } = renderRegistration({
            snapshot: SNAPSHOT,
            dataUpdatedAt: 0,
        });
        expect(result.current?.status).toBe('success');
        expect(result.current?.context.analyzedAt).toBeUndefined();
    });
});
