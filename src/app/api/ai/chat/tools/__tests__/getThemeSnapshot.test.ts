import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { provider, asset, forming } = vi.hoisted(() => ({
    provider: { getBars: vi.fn() },
    asset: { info: vi.fn() },
    forming: { value: false },
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => provider,
}));
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: asset.info,
}));
vi.mock('@/entities/bars/lib/quantizeBars', () => ({
    lastBarIsForming: () => forming.value,
}));

import { AGENT_THEMES, type ThemeSnapshot } from '@y0ngha/siglens-core';
import { isRecord } from '@/shared/lib/isRecord';
import {
    getThemeSnapshotTool,
    loadThemeSnapshot,
} from '@/app/api/ai/chat/tools/getThemeSnapshot';
import { TOOL_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const run = (args: Record<string, unknown>) =>
    getThemeSnapshotTool(args, ctx, rt);

type OkSnapshot = ThemeSnapshot & {
    asOf: string;
    source: string;
    available: true;
};

function isOkSnapshot(result: unknown): result is OkSnapshot {
    return isRecord(result) && result.available === true;
}

/** 성공 결과로 좁힌다(타입 가드 — 실행기는 `available: true`일 때 core 결과를 그대로 펼쳐 싣는다). */
function okSnapshot(result: unknown): OkSnapshot {
    if (!isOkSnapshot(result))
        throw new Error(
            `expected an available result: ${JSON.stringify(result)}`
        );
    return result;
}

const DAY = 86_400;
/** n개 일봉: 마지막 종가가 last, 그 앞은 100. */
const bars = (n: number, last: number) =>
    Array.from({ length: n }, (_, i) => ({
        time: 1_760_000_000 + i * DAY,
        open: 100,
        high: 100,
        low: 100,
        close: i === n - 1 ? last : 100,
        volume: 1,
    }));

beforeEach(() => {
    provider.getBars.mockReset();
    asset.info.mockReset();
    asset.info.mockResolvedValue(null);
    forming.value = false;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getThemeSnapshotTool', () => {
    it('바스켓 종목 일봉을 읽어 core 집계를 싣고, 이름은 한국어 이름을 먼저 쓴다', async () => {
        provider.getBars.mockImplementation(
            async ({ symbol }: { symbol: string }) =>
                bars(30, symbol === 'IONQ' ? 110 : 95)
        );
        asset.info.mockImplementation(async (symbol: string) =>
            symbol === 'IONQ'
                ? { symbol, name: 'IonQ, Inc.', koreanName: '아이온큐' }
                : null
        );
        const result = okSnapshot(await run({ theme: 'quantum' }));
        expect(result).toMatchObject({
            source: 'SIGLENS theme basket (daily closes)',
            available: true,
            theme: { id: 'quantum', nameKo: '양자컴퓨팅' },
            missing: [],
        });
        expect(result.members[0]).toMatchObject({
            symbol: 'IONQ',
            name: '아이온큐',
            changePct: { '1d': 10 },
        });
        expect(result.summary['1d']).toMatchObject({ up: 1, down: 5 });
        const quantum = AGENT_THEMES.find(t => t.id === 'quantum');
        if (quantum === undefined) throw new Error('quantum theme missing');
        expect(provider.getBars).toHaveBeenCalledTimes(quantum.symbols.length);
        const [firstCall] = provider.getBars.mock.calls;
        if (firstCall === undefined) throw new Error('getBars not called');
        expect(firstCall[0]).toMatchObject({ timeframe: '1Day' });
    });

    it('정규장 중이면 마지막(진행 중) 봉을 빼고 완결 종가로만 센다', async () => {
        forming.value = true;
        provider.getBars.mockResolvedValue(bars(30, 150)); // 진행 중인 봉 150
        const result = okSnapshot(await run({ theme: 'quantum' }));
        expect(result.members[0].changePct['1d']).toBe(0);
    });

    it('일부 종목 실패는 missing, 전부 실패면 provider_failed', async () => {
        provider.getBars.mockImplementation(
            async ({ symbol }: { symbol: string }) => {
                if (symbol === 'IONQ') return bars(30, 101);
                throw new Error('fmp down');
            }
        );
        const partial = okSnapshot(await run({ theme: 'quantum' }));
        expect(partial.members.map(m => m.symbol)).toEqual(['IONQ']);
        expect(partial.missing).toHaveLength(5);
        provider.getBars.mockRejectedValue(new Error('fmp down'));
        expect(await run({ theme: 'quantum' })).toEqual({
            theme: 'quantum',
            available: false,
            reason: 'provider_failed',
        });
    });

    it('한국 테마도 같은 경로로 읽고, 가장 큰 바스켓(8종목)도 기본 결과 상한 안에 든다', async () => {
        provider.getBars.mockResolvedValue(bars(260, 123.45));
        asset.info.mockImplementation(async (symbol: string) => ({
            symbol,
            name: 'A Very Long Company Name Holdings Incorporated',
            koreanName: '아주 긴 한국어 회사 이름 주식회사',
        }));
        const kr = okSnapshot(await run({ theme: 'kr_battery' }));
        expect(kr.theme.market).toBe('kr');
        const big = await run({ theme: 'ai_semis' });
        expect(JSON.stringify(big).length).toBeLessThan(TOOL_RESULT_MAX_CHARS);
    });

    it('12초 안에 오지 않는 종목은 missing으로 돌리고 나머지로 집계한다(시간 예산)', async () => {
        vi.useFakeTimers();
        try {
            provider.getBars.mockImplementation(
                ({ symbol }: { symbol: string }) =>
                    symbol === 'IONQ'
                        ? new Promise(() => {})
                        : Promise.resolve(bars(30, 101))
            );
            const pending = run({ theme: 'quantum' });
            await vi.advanceTimersByTimeAsync(12_000);
            const result = okSnapshot(await pending);
            expect(result.missing).toEqual(['IONQ']);
            expect(result.members).toHaveLength(5);
        } finally {
            vi.useRealTimers();
        }
    });

    it('목록에 없는 테마는 invalid_args', async () => {
        expect(await run({ theme: 'robots' })).toEqual({
            error: 'invalid_args',
        });
        expect(provider.getBars).not.toHaveBeenCalled();
    });
});

describe('loadThemeSnapshot', () => {
    it('테마 객체로 직접 읽고 도구와 같은 값을 돌려준다(show_chart 히트맵이 이 로더를 쓴다)', async () => {
        provider.getBars.mockResolvedValue(bars(30, 110));
        const quantum = AGENT_THEMES.find(t => t.id === 'quantum');
        if (quantum === undefined) throw new Error('quantum theme missing');
        const direct = okSnapshot(await loadThemeSnapshot(quantum));
        const viaTool = okSnapshot(await run({ theme: 'quantum' }));
        expect({ ...direct, asOf: '' }).toEqual({ ...viaTool, asOf: '' });
    });

    it('종목을 하나도 못 읽으면 provider_failed', async () => {
        provider.getBars.mockRejectedValue(new Error('fmp down'));
        const quantum = AGENT_THEMES.find(t => t.id === 'quantum');
        if (quantum === undefined) throw new Error('quantum theme missing');
        expect(await loadThemeSnapshot(quantum)).toEqual({
            theme: 'quantum',
            available: false,
            reason: 'provider_failed',
        });
    });
});
