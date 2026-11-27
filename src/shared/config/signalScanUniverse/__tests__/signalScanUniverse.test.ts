import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import { KR_SHORT_CODE_RE, KR_SYMBOL_RE } from '@/shared/config/ticker';
import { KR_INDEX_UNIVERSE_SNAPSHOT } from '../krIndexUniverse.generated';
import {
    KR_INDEX_COUNT_TOLERANCE,
    KR_INDEX_SIZE,
    US_SP500_COUNT_RANGE,
} from '../signalScanUniverseConstants';
import {
    SIGNAL_SCAN_UNIVERSE_AS_OF,
    SIGNAL_SCAN_UNIVERSE_SIZE,
    signalScanTargets,
    type SignalScanMarket,
} from '../signalScanUniverse';
import { US_SP500_SNAPSHOT } from '../usSp500.generated';

const MARKETS: readonly SignalScanMarket[] = ['us', 'kr'];
/** 미국 심볼 형상 — `indexConstituents.ts`의 `SYMBOL_SHAPE`와 같다. */
const US_SYMBOL_SHAPE = /^[A-Z0-9]{1,6}(\.[A-Z])?$/;
const AS_OF_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

describe('S&P 500 스냅샷', () => {
    it('개수가 허용 범위 안이다 (한 발행사 한 종류만 남긴 뒤라 503보다 적다)', () => {
        expect(US_SP500_SNAPSHOT.symbols.length).toBeGreaterThanOrEqual(
            US_SP500_COUNT_RANGE.min - 3
        );
        expect(US_SP500_SNAPSHOT.symbols.length).toBeLessThanOrEqual(
            US_SP500_COUNT_RANGE.max
        );
    });

    it('모든 심볼이 미국 심볼 형상이고 중복이 없으며 정렬돼 있다', () => {
        const symbols = US_SP500_SNAPSHOT.symbols;
        expect(symbols.every(s => US_SYMBOL_SHAPE.test(s))).toBe(true);
        expect(new Set(symbols).size).toBe(symbols.length);
        expect([...symbols].sort()).toEqual([...symbols]);
    });

    it('같은 발행사의 두 번째 주식 종류는 없다', () => {
        const symbols: readonly string[] = US_SP500_SNAPSHOT.symbols;
        expect(symbols).toContain('GOOGL');
        expect(symbols).not.toContain('GOOG');
        expect(symbols).not.toContain('FOX');
        expect(symbols).not.toContain('NWS');
    });

    it('기준일 형식이 맞다', () => {
        expect(US_SP500_SNAPSHOT.asOf).toMatch(AS_OF_SHAPE);
    });
});

describe('코스피 200 + 코스닥 150 스냅샷', () => {
    const { kospi200, kosdaq150 } = KR_INDEX_UNIVERSE_SNAPSHOT;

    it('종목 수가 지수 크기에서 허용 폭(5) 넘게 벗어나지 않는다', () => {
        expect(
            Math.abs(kospi200.length - KR_INDEX_SIZE.kospi200)
        ).toBeLessThanOrEqual(KR_INDEX_COUNT_TOLERANCE);
        expect(
            Math.abs(kosdaq150.length - KR_INDEX_SIZE.kosdaq150)
        ).toBeLessThanOrEqual(KR_INDEX_COUNT_TOLERANCE);
    });

    it('프록시가 아니면 개수가 정확히 200·150이다', () => {
        if (KR_INDEX_UNIVERSE_SNAPSHOT.proxy) return;
        expect(kospi200).toHaveLength(KR_INDEX_SIZE.kospi200);
        expect(kosdaq150).toHaveLength(KR_INDEX_SIZE.kosdaq150);
    });

    it('심볼이 한국 심볼 형상이고 코스피는 .KS, 코스닥은 .KQ다', () => {
        expect(kospi200.every(c => KR_SYMBOL_RE.test(c.symbol))).toBe(true);
        expect(kosdaq150.every(c => KR_SYMBOL_RE.test(c.symbol))).toBe(true);
        expect(kospi200.every(c => c.symbol.endsWith('.KS'))).toBe(true);
        expect(kosdaq150.every(c => c.symbol.endsWith('.KQ'))).toBe(true);
        expect(
            [...kospi200, ...kosdaq150].every(c =>
                KR_SHORT_CODE_RE.test(c.symbol.slice(0, 6))
            )
        ).toBe(true);
    });

    it('두 목록 사이에도 중복이 없고, 모든 종목에 한글명이 있다', () => {
        const all = [...kospi200, ...kosdaq150];
        expect(new Set(all.map(c => c.symbol.slice(0, 6))).size).toBe(
            all.length
        );
        expect(all.every(c => c.koreanName.trim() !== '')).toBe(true);
    });

    it('프록시 여부와 출처가 기록돼 있다', () => {
        expect(KR_INDEX_UNIVERSE_SNAPSHOT.asOf).toMatch(AS_OF_SHAPE);
        expect(KR_INDEX_UNIVERSE_SNAPSHOT.sourceDetail).not.toBe('');
        expect(KR_INDEX_UNIVERSE_SNAPSHOT.proxy).toBe(
            KR_INDEX_UNIVERSE_SNAPSHOT.source === 'etf-proxy'
        );
    });
});

describe('signalScanTargets', () => {
    it.each(MARKETS)('%s: 대시보드 스캐너 종목이 모두 들어 있다', market => {
        const symbols = new Set(signalScanTargets(market).map(t => t.symbol));
        dashboardScopeOf(market).sectorStocks.forEach(stock => {
            expect(symbols.has(stock.symbol)).toBe(true);
        });
    });

    it.each(MARKETS)('%s: 중복이 없고 심볼 순으로 정렬돼 있다', market => {
        const symbols = signalScanTargets(market).map(t => t.symbol);
        expect(new Set(symbols).size).toBe(symbols.length);
        expect([...symbols].sort()).toEqual(symbols);
    });

    it('대시보드 종목의 손으로 고른 한글명이 스냅샷 이름보다 앞선다', () => {
        const sample = dashboardScopeOf('kr').sectorStocks[0];
        expect(sample).toBeDefined();
        const target = signalScanTargets('kr').find(
            t => t.symbol === sample?.symbol
        );
        expect(target?.koreanName).toBe(sample?.koreanName);
    });

    it('미국 스냅샷 종목은 한글명 없이 들어간다', () => {
        const curated = new Set(
            dashboardScopeOf('us').sectorStocks.map(s => s.symbol)
        );
        const fromSnapshotOnly = signalScanTargets('us').filter(
            t => !curated.has(t.symbol)
        );
        expect(fromSnapshotOnly.length).toBeGreaterThan(300);
        expect(fromSnapshotOnly.every(t => t.koreanName === null)).toBe(true);
    });

    it('크기·기준일 상수가 목록과 스냅샷에서 나온다', () => {
        expect(SIGNAL_SCAN_UNIVERSE_SIZE.us).toBe(
            signalScanTargets('us').length
        );
        expect(SIGNAL_SCAN_UNIVERSE_SIZE.kr).toBe(
            signalScanTargets('kr').length
        );
        expect(SIGNAL_SCAN_UNIVERSE_AS_OF).toEqual({
            us: US_SP500_SNAPSHOT.asOf,
            kr: KR_INDEX_UNIVERSE_SNAPSHOT.asOf,
        });
    });

    it('한국 대상 수는 지수 크기 + 지수 밖 대시보드 종목 안이다', () => {
        const indexCodes = new Set<string>(
            [
                ...KR_INDEX_UNIVERSE_SNAPSHOT.kospi200,
                ...KR_INDEX_UNIVERSE_SNAPSHOT.kosdaq150,
            ].map(c => c.symbol)
        );
        const extra = dashboardScopeOf('kr').sectorStocks.filter(
            s => !indexCodes.has(s.symbol)
        ).length;
        expect(SIGNAL_SCAN_UNIVERSE_SIZE.kr).toBe(indexCodes.size + extra);
    });
});
