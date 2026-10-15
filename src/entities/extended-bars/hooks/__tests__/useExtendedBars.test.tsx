vi.mock('@/entities/extended-bars/actions/getExtendedBarsAction', () => ({
    getExtendedBarsAction: vi.fn(),
}));
vi.mock('@/shared/hooks/useHumanInteracted', () => ({
    useHumanInteracted: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar, Timeframe } from '@y0ngha/siglens-core';
import { getExtendedBarsAction } from '@/entities/extended-bars/actions/getExtendedBarsAction';
import {
    isExtendedBarsFetchEnabled,
    useExtendedBars,
} from '@/entities/extended-bars/hooks/useExtendedBars';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

const mockedAction = vi.mocked(getExtendedBarsAction);
const mockedHuman = vi.mocked(useHumanInteracted);

const BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
];

const clients: QueryClient[] = [];
function makeClient(): QueryClient {
    const client = new QueryClient();
    clients.push(client);
    return client;
}
function wrapperFor(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

interface HookProps {
    timeframe?: Timeframe;
    marketProfile?: MarketProfileId;
    toggledOn?: boolean;
}

function render(client: QueryClient, props: HookProps = {}) {
    return renderHook(
        (p: HookProps) =>
            useExtendedBars({
                symbol: 'aapl',
                timeframe: p.timeframe ?? '5Min',
                marketProfile: p.marketProfile ?? 'us-equity',
                toggledOn: p.toggledOn ?? true,
            }),
        { wrapper: wrapperFor(client), initialProps: props }
    );
}

describe('isExtendedBarsFetchEnabled — 조회 자격 행렬', () => {
    const base = {
        marketProfile: 'us-equity',
        timeframe: '5Min',
        toggledOn: true,
        humanInteracted: true,
    } as const;

    it('미국 주식·인트라데이·토글 켜짐·사람 입력 있음이면 켠다', () => {
        expect(isExtendedBarsFetchEnabled(base)).toBe(true);
    });

    it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour'] as const)(
        '%s는 켠다',
        timeframe => {
            expect(isExtendedBarsFetchEnabled({ ...base, timeframe })).toBe(
                true
            );
        }
    );

    it('1Day는 끈다', () => {
        expect(isExtendedBarsFetchEnabled({ ...base, timeframe: '1Day' })).toBe(
            false
        );
    });

    it.each(['kr-equity', 'crypto'] as const)('%s는 끈다', marketProfile => {
        expect(isExtendedBarsFetchEnabled({ ...base, marketProfile })).toBe(
            false
        );
    });

    it('토글이 꺼져 있으면 끈다', () => {
        expect(isExtendedBarsFetchEnabled({ ...base, toggledOn: false })).toBe(
            false
        );
    });

    it('사람 입력이 없으면(크롤러·SSR 직후) 끈다', () => {
        expect(
            isExtendedBarsFetchEnabled({ ...base, humanInteracted: false })
        ).toBe(false);
    });
});

describe('useExtendedBars', () => {
    beforeEach(() => {
        mockedAction.mockReset();
        mockedAction.mockResolvedValue(BARS);
        mockedHuman.mockReturnValue(true);
    });
    afterEach(() => {
        clients.splice(0).forEach(c => c.clear());
    });

    it('자격이 되면 대문자 심볼·타임프레임으로 액션을 부르고 봉을 돌려준다', async () => {
        const { result } = render(makeClient());
        await waitFor(() => expect(result.current).toEqual(BARS));
        expect(mockedAction).toHaveBeenCalledWith('AAPL', '5Min');
    });

    it('정규장 봉 키(`bars`)와 다른 키를 쓴다', async () => {
        const client = makeClient();
        const { result } = render(client);
        await waitFor(() => expect(result.current).toEqual(BARS));
        expect(
            client.getQueryData(QUERY_KEYS.extendedBars('aapl', '5Min'))
        ).toEqual(BARS);
        expect(
            client.getQueryData(QUERY_KEYS.bars('aapl', '5Min'))
        ).toBeUndefined();
    });

    it.each([
        ['1Day', { timeframe: '1Day' as const }],
        ['크립토', { marketProfile: 'crypto' as const }],
        ['한국 주식', { marketProfile: 'kr-equity' as const }],
        ['토글 꺼짐', { toggledOn: false }],
    ])('%s이면 액션을 부르지 않고 null이다', async (_label, props) => {
        const { result } = render(makeClient(), props);
        await Promise.resolve();
        expect(mockedAction).not.toHaveBeenCalled();
        expect(result.current).toBeNull();
    });

    it('사람 입력이 없으면 액션을 부르지 않는다', async () => {
        mockedHuman.mockReturnValue(false);
        const { result } = render(makeClient());
        await Promise.resolve();
        expect(mockedAction).not.toHaveBeenCalled();
        expect(result.current).toBeNull();
    });

    it('토글을 끄면 캐시에 남은 확장 봉도 돌려주지 않는다', async () => {
        const client = makeClient();
        const { result, rerender } = render(client);
        await waitFor(() => expect(result.current).toEqual(BARS));
        rerender({ toggledOn: false });
        expect(result.current).toBeNull();
        rerender({ toggledOn: true });
        expect(result.current).toEqual(BARS);
    });

    it('일봉으로 옮기면 인트라데이에서 받은 확장 봉을 돌려주지 않는다', async () => {
        const client = makeClient();
        const { result, rerender } = render(client);
        await waitFor(() => expect(result.current).toEqual(BARS));
        rerender({ timeframe: '1Day' });
        expect(result.current).toBeNull();
    });

    it('액션이 null(서버 게이트·장애)이면 null을 유지하고 재시도하지 않는다', async () => {
        mockedAction.mockResolvedValue(null);
        const { result } = render(makeClient());
        await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));
        await Promise.resolve();
        expect(result.current).toBeNull();
        expect(mockedAction).toHaveBeenCalledTimes(1);
    });
});
