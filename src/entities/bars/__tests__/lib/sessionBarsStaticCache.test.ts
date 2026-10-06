import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockShortenRevalidate,
    mockShortenIncomplete,
    memoStores,
    cacheStore,
    cacheCalls,
} = vi.hoisted(() => ({
    mockShortenRevalidate: vi.fn(async () => undefined),
    mockShortenIncomplete: vi.fn(async () => undefined),
    // React.cache는 서버 렌더 컨텍스트 밖에서는 메모이즈하지 않는다 — 요청 스코프 메모를
    // 인자 키 Map으로 흉내 내고, 테스트(=요청)마다 비운다.
    memoStores: [] as Map<string, unknown>[],
    // `unstable_cache`의 저장 의미론만 흉내 낸다: 키가 있으면 그 값, 없으면 콜백을 돌려
    // **던지지 않았을 때만** 저장한다.
    cacheStore: new Map<string, unknown>(),
    cacheCalls: [] as {
        keyParts: string[];
        options: { revalidate: number; tags: string[] };
    }[],
}));

vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
        const store = new Map<string, unknown>();
        memoStores.push(store);
        return (...args: A): R => {
            const key = JSON.stringify(args);
            if (!store.has(key)) store.set(key, fn(...args));
            return store.get(key) as R;
        };
    },
}));
vi.mock('next/cache', () => ({
    unstable_cache:
        (
            fn: () => Promise<unknown>,
            keyParts: string[],
            options: { revalidate: number; tags: string[] }
        ) =>
        async () => {
            cacheCalls.push({ keyParts, options });
            const key = JSON.stringify(keyParts);
            if (cacheStore.has(key)) return cacheStore.get(key);
            const value = await fn();
            cacheStore.set(key, value);
            return value;
        },
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: mockShortenRevalidate,
    shortenRevalidateForIncompleteSession: mockShortenIncomplete,
}));
vi.mock('@/entities/bars/lib/loadBarsData', () => ({
    loadBarsData: vi.fn(),
}));

import type { BarsData } from '@y0ngha/siglens-core';
import {
    getSessionBarsStatic,
    getSymbolFearGreedChipStatic,
} from '@/entities/bars/lib/sessionBarsStaticCache';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { symbolFearGreedSnapshot } from '@/entities/bars/lib/symbolFearGreed';
import { toSessionBarsData } from '@/entities/bars/lib/sessionBars';
import { SESSION_KEYED_CACHE_REVALIDATE_SECONDS } from '@/shared/config/time';

const mockLoad = vi.mocked(loadBarsData);

const DAY_SEC = 86_400;

/** `lastDate`(포함)까지 매일 하나씩 `length`개의 일봉. 점수가 나올 만큼 길게 쓴다. */
function dailyBars(lastDate: string, length: number): BarsData {
    const lastSec = Date.parse(`${lastDate}T00:00:00Z`) / 1000;
    const bars = Array.from({ length }, (_, i) => {
        const close = 100 + 10 * Math.sin(i / 9) + i * 0.05;
        return {
            time: lastSec - (length - 1 - i) * DAY_SEC,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1000 + (i % 7) * 50,
        };
    });
    return {
        bars,
        indicators: {
            buySellVolume: bars.map((_, i) => ({
                buyVolume: 500 + (i % 5) * 20,
                sellVolume: 500 - (i % 3) * 10,
            })),
        },
    } as unknown as BarsData;
}

/** 2026-10-07(수) 08:00 ET — 미국 마지막 마감 세션은 2026-10-06(화). */
const US_MORNING = new Date('2026-10-07T12:00:00Z');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(US_MORNING);
    for (const store of memoStores) store.clear();
    cacheStore.clear();
    cacheCalls.length = 0;
    mockLoad.mockReset();
    mockShortenRevalidate.mockClear();
    mockShortenIncomplete.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

/** 테스트 안에서 "다음 요청"을 흉내 낸다 — 요청 스코프 메모만 비운다. */
function nextRequest(): void {
    for (const store of memoStores) store.clear();
}

describe('세션 키 — revalidate는 길게, 신선도는 키가 책임진다', () => {
    it('키에 시장의 마지막 마감 세션 날짜가 들어가고 revalidate는 24h 이상이다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 120));

        await getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL');
        await getSessionBarsStatic('AAPL', 'us-equity', 'AAPL');

        expect(cacheCalls.map(c => c.keyParts)).toEqual([
            ['symbol-fg-chip-v1', 'AAPL', 'AAPL', '2026-10-06'],
            ['session-bars-v1', 'AAPL', 'AAPL', '2026-10-06'],
        ]);
        for (const { options } of cacheCalls) {
            // 가장 긴 `[symbol]` 탭 선언(24h) 이상이어야 clamp가 없다.
            expect(options.revalidate).toBe(
                SESSION_KEYED_CACHE_REVALIDATE_SECONDS
            );
            expect(options.revalidate).toBeGreaterThanOrEqual(86_400);
            expect(options.tags).toEqual(['symbol:AAPL']);
        }
    });

    it('세션이 넘어가면 새 키를 읽는다 — revalidate(24h)를 기다리지 않고 칩이 갱신된다', async () => {
        mockLoad.mockResolvedValueOnce(dailyBars('2026-10-06', 120));
        const before = await getSymbolFearGreedChipStatic(
            'AAPL',
            'us-equity',
            'AAPL'
        );

        // 다음 날 08:00 ET — 2026-10-07 세션이 마감 + 버퍼를 지났다.
        vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
        nextRequest();
        mockLoad.mockResolvedValueOnce(dailyBars('2026-10-07', 121));
        const after = await getSymbolFearGreedChipStatic(
            'AAPL',
            'us-equity',
            'AAPL'
        );

        expect(mockLoad).toHaveBeenCalledTimes(2);
        expect(cacheCalls.at(-1)?.keyParts.at(-1)).toBe('2026-10-07');
        expect(after).not.toEqual(before);
    });

    it('같은 세션 안의 다음 요청은 저장된 값을 읽는다 (provider 왕복 없음)', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 120));

        await getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL');
        nextRequest();
        await getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL');

        expect(mockLoad).toHaveBeenCalledTimes(1);
    });

    it('한국 종목은 KRX 달력으로 키를 만든다 (개천절 대체공휴일 10-05는 건너뛴다)', async () => {
        // 2026-10-06 10:00 KST(장중) — 마지막 마감 세션은 10-02(금). 10-05는 KRX 휴장.
        vi.setSystemTime(new Date('2026-10-06T01:00:00Z'));
        mockLoad.mockResolvedValue(dailyBars('2026-10-02', 120));

        await getSymbolFearGreedChipStatic('005930', 'kr-equity', '005930.KS');

        expect(cacheCalls[0]?.keyParts).toEqual([
            'symbol-fg-chip-v1',
            '005930',
            '005930.KS',
            '2026-10-02',
        ]);
    });

    it('크립토는 UTC 어제가 키다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 120));

        await getSymbolFearGreedChipStatic('BTCUSD', 'crypto');

        expect(cacheCalls[0]?.keyParts).toEqual([
            'symbol-fg-chip-v1',
            'BTCUSD',
            '',
            '2026-10-06',
        ]);
    });
});

describe('값 — 세션 날짜까지로 자른 봉에서 계산한다', () => {
    it('칩은 세션까지로 자른 봉의 스냅샷이다 (장중 형성 봉은 점수에 섞이지 않는다)', async () => {
        // 10-07 장중 형성 봉이 붙어 온 응답.
        const raw = dailyBars('2026-10-07', 121);
        mockLoad.mockResolvedValue(raw);

        const chip = await getSymbolFearGreedChipStatic(
            'AAPL',
            'us-equity',
            'AAPL'
        );

        expect(chip).not.toBeNull();
        expect(chip).toEqual(
            symbolFearGreedSnapshot(toSessionBarsData(raw, '2026-10-06'))
        );
    });

    it('공포·탐욕 탭 본문의 축소 봉과 칩은 같은 입력이다 (한 요청의 provider 왕복도 하나)', async () => {
        const raw = dailyBars('2026-10-07', 121);
        mockLoad.mockResolvedValue(raw);

        const [chip, bars] = await Promise.all([
            getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL'),
            getSessionBarsStatic('AAPL', 'us-equity', 'AAPL'),
        ]);

        expect(mockLoad).toHaveBeenCalledTimes(1);
        expect(mockLoad).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
        expect(bars.bars.at(-1)?.time).toBe(
            Date.parse('2026-10-06T00:00:00Z') / 1000
        );
        expect(chip).toEqual(symbolFearGreedSnapshot(bars));
    });

    it('소문자 ticker도 대문자로 키잉한다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 120));

        await getSessionBarsStatic('aapl', 'us-equity');

        expect(cacheCalls[0]?.keyParts[1]).toBe('AAPL');
        expect(cacheCalls[0]?.options.tags).toEqual(['symbol:AAPL']);
    });
});

describe('저장하지 않는 값', () => {
    it('직전 거래일까지만 있으면(EOD 발행 지연) 이번 렌더에만 쓰고 저장하지 않으며, revalidate를 1h로 낮춘다', async () => {
        const lagging = dailyBars('2026-10-05', 120);
        mockLoad.mockResolvedValue(lagging);

        const first = await getSessionBarsStatic('AAPL', 'us-equity', 'AAPL');
        nextRequest();
        await getSessionBarsStatic('AAPL', 'us-equity', 'AAPL');

        expect(first.bars).toHaveLength(120);
        // 저장됐다면 두 번째 요청은 provider를 다시 부르지 않는다.
        expect(mockLoad).toHaveBeenCalledTimes(2);
        // ISR HTML이 직전 세션 값을 24h 들고 있지 않게 — 렌더마다 1h 핀.
        expect(mockShortenIncomplete).toHaveBeenCalledTimes(2);
        // 장애가 아니다 — 300초 degrade 핀은 걸지 않는다.
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });

    it('롱테일 종목도 lagging이면 1h 핀을 건다 (큐레이션 여부 무관)', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-05', 120));

        await getSymbolFearGreedChipStatic('ZZZZQ', 'us-equity');

        expect(mockShortenIncomplete).toHaveBeenCalledTimes(1);
        expect(cacheStore.size).toBe(0);
    });

    it('휴장일 표 공백(표가 모르는 KRX 임시 휴장) — 키의 봉이 영영 오지 않아도 렌더마다 1h 핀으로 묶이고, 다음 롤이 끝낸다', async () => {
        // 2026-10-07 10:00 KST(장중). 표가 10-06을 거래일로 알지만 실제로는 휴장이었다고 하자 —
        // 키는 10-06, 봉은 10-02(직전 거래일)까지만 있다.
        vi.setSystemTime(new Date('2026-10-07T01:00:00Z'));
        mockLoad.mockResolvedValue(dailyBars('2026-10-02', 120));

        await getSymbolFearGreedChipStatic('005930', 'kr-equity', '005930.KS');
        nextRequest();
        await getSymbolFearGreedChipStatic('005930', 'kr-equity', '005930.KS');

        expect(cacheCalls.at(-1)?.keyParts.at(-1)).toBe('2026-10-06');
        // 저장되지 않으므로 렌더마다 다시 읽는다 — 1h 핀이 그 빈도를 시간당 1회로 묶는다.
        expect(mockLoad).toHaveBeenCalledTimes(2);
        expect(mockShortenIncomplete).toHaveBeenCalledTimes(2);

        // 다음 세션(10-07) 마감 + 버퍼 뒤에는 새 키, 봉도 도착 → 저장된다.
        vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
        nextRequest();
        mockLoad.mockResolvedValue(dailyBars('2026-10-07', 121));
        await getSymbolFearGreedChipStatic('005930', 'kr-equity', '005930.KS');
        expect(cacheCalls.at(-1)?.keyParts.at(-1)).toBe('2026-10-07');
        expect(cacheStore.size).toBe(1);
    });

    it('직전 거래일보다도 오래된 봉(거래 정지·상장폐지)은 저장한다 — 매 렌더 provider를 부르지 않게', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-09-15', 120));

        await getSessionBarsStatic('ZZZZQ', 'us-equity');
        nextRequest();
        await getSessionBarsStatic('ZZZZQ', 'us-equity');

        expect(mockLoad).toHaveBeenCalledTimes(1);
        expect(mockShortenIncomplete).not.toHaveBeenCalled();
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });

    it('complete면 어떤 핀도 걸지 않는다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 120));

        await getSessionBarsStatic('AAPL', 'us-equity', 'AAPL');

        expect(mockShortenIncomplete).not.toHaveBeenCalled();
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });

    it('봉 0개면 빈 BarsData를 돌려주고, 큐레이션 종목은 revalidate를 300초로 낮춘다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 0));

        const out = await getSessionBarsStatic('AAPL', 'us-equity', 'AAPL');

        expect(out.bars).toEqual([]);
        expect(cacheStore.size).toBe(0);
        expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        expect(mockShortenIncomplete).not.toHaveBeenCalled();
    });

    it('봉 0개면 칩은 null이다', async () => {
        mockLoad.mockResolvedValue(dailyBars('2026-10-06', 0));

        await expect(
            getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL')
        ).resolves.toBeNull();
    });

    it('provider 예외는 그대로 던지고 큐레이션 종목은 revalidate를 낮춘다', async () => {
        mockLoad.mockRejectedValue(new Error('FMP 402'));

        await expect(
            getSymbolFearGreedChipStatic('AAPL', 'us-equity', 'AAPL')
        ).rejects.toThrow('FMP 402');
        expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
    });

    it('롱테일 종목의 실패·빈 결과는 재생성 비용을 쓰지 않는다', async () => {
        mockLoad.mockResolvedValueOnce(dailyBars('2026-10-06', 0));
        await getSessionBarsStatic('ZZZZQ', 'us-equity');
        nextRequest();
        mockLoad.mockRejectedValueOnce(new Error('boom'));
        await expect(
            getSessionBarsStatic('ZZZZQ', 'us-equity')
        ).rejects.toThrow('boom');

        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });

    it('Next 제어 흐름 에러(DYNAMIC_SERVER_USAGE)는 degrade 처리 없이 그대로 던진다', async () => {
        mockLoad.mockRejectedValue(
            Object.assign(new Error('Dynamic server usage'), {
                digest: 'DYNAMIC_SERVER_USAGE',
            })
        );

        await expect(
            getSessionBarsStatic('AAPL', 'us-equity', 'AAPL')
        ).rejects.toThrow('Dynamic server usage');
        expect(mockShortenRevalidate).not.toHaveBeenCalled();
    });
});
