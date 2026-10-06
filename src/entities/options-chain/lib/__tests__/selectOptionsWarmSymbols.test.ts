import { POPULAR_OPTIONS_TICKERS } from '@/shared/config/popular-options-tickers';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import {
    OPTIONS_WARM_UNIVERSE_SIZE,
    buildOptionsWarmUniverse,
    selectOptionsWarmSymbols,
} from '../selectOptionsWarmSymbols';

const UNIVERSE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const never = (): boolean => false;

describe('buildOptionsWarmUniverse', () => {
    it('상위 100개로 자른다', () => {
        expect(OPTIONS_WARM_UNIVERSE_SIZE).toBe(100);
        expect(buildOptionsWarmUniverse()).toHaveLength(100);
    });

    it('옵션 종목 화이트리스트에 있는 심볼만 담는다', () => {
        const allowed = new Set<string>(POPULAR_OPTIONS_TICKERS);
        expect(
            buildOptionsWarmUniverse(10_000).every(s => allowed.has(s))
        ).toBe(true);
    });

    it('POPULAR_TICKERS의 노출 순서를 따른다(알파벳 순이 아니다)', () => {
        const universe = buildOptionsWarmUniverse();
        const positions = universe.map(s =>
            (POPULAR_TICKERS as readonly string[]).indexOf(s)
        );
        expect(positions.every(p => p >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(universe.slice(0, 3)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    });

    it('옵션 화이트리스트에 없는 인기 종목은 빠진다', () => {
        const allowed = new Set<string>(POPULAR_OPTIONS_TICKERS);
        const excluded = POPULAR_TICKERS.find(s => !allowed.has(s));
        expect(excluded).toBeDefined();
        expect(buildOptionsWarmUniverse(10_000)).not.toContain(excluded);
    });

    it('size 인자로 크기를 줄일 수 있다', () => {
        expect(buildOptionsWarmUniverse(5)).toHaveLength(5);
    });
});

describe('selectOptionsWarmSymbols', () => {
    it('커서 위치부터 batchSize개를 순서대로 고른다', () => {
        const result = selectOptionsWarmSymbols({
            universe: UNIVERSE,
            cursor: 2,
            batchSize: 3,
            isCaptured: never,
        });
        expect(result.picks.map(p => p.symbol)).toEqual(['C', 'D', 'E']);
        expect(result.examined).toBe(3);
        expect(result.skipped).toBe(0);
    });

    it('이미 확보된 종목은 건너뛰되 걸음 수에는 센다', () => {
        const captured = new Set(['C', 'D']);
        const result = selectOptionsWarmSymbols({
            universe: UNIVERSE,
            cursor: 2,
            batchSize: 3,
            isCaptured: s => captured.has(s),
        });
        expect(result.picks.map(p => p.symbol)).toEqual(['E', 'F', 'G']);
        expect(result.skipped).toBe(2);
        expect(result.examined).toBe(5);
        expect(result.picks.map(p => p.step)).toEqual([3, 4, 5]);
    });

    it('끝에서 처음으로 감싸 돈다(cursor wraparound)', () => {
        const result = selectOptionsWarmSymbols({
            universe: UNIVERSE,
            cursor: 6,
            batchSize: 4,
            isCaptured: never,
        });
        expect(result.picks.map(p => p.symbol)).toEqual(['G', 'H', 'A', 'B']);
    });

    it('커서가 유니버스 길이를 넘어도 모듈로로 처리한다', () => {
        const result = selectOptionsWarmSymbols({
            universe: UNIVERSE,
            cursor: 8 * 5 + 1,
            batchSize: 2,
            isCaptured: never,
        });
        expect(result.picks.map(p => p.symbol)).toEqual(['B', 'C']);
    });

    it('전부 확보됐으면 한 바퀴만 훑고 끝낸다', () => {
        const isCaptured = vi.fn(() => true);
        const result = selectOptionsWarmSymbols({
            universe: UNIVERSE,
            cursor: 3,
            batchSize: 6,
            isCaptured,
        });
        expect(result.picks).toEqual([]);
        expect(result.skipped).toBe(UNIVERSE.length);
        expect(result.examined).toBe(UNIVERSE.length);
        expect(isCaptured).toHaveBeenCalledTimes(UNIVERSE.length);
    });

    it('남은 종목이 batchSize보다 적으면 한 바퀴를 넘지 않고 같은 종목을 두 번 고르지 않는다', () => {
        const result = selectOptionsWarmSymbols({
            universe: ['A', 'B', 'C'],
            cursor: 1,
            batchSize: 6,
            isCaptured: never,
        });
        expect(result.picks.map(p => p.symbol)).toEqual(['B', 'C', 'A']);
    });

    it('빈 유니버스·0 batchSize는 아무것도 고르지 않는다', () => {
        expect(
            selectOptionsWarmSymbols({
                universe: [],
                cursor: 0,
                batchSize: 6,
                isCaptured: never,
            })
        ).toEqual({ picks: [], skipped: 0, examined: 0 });
        expect(
            selectOptionsWarmSymbols({
                universe: UNIVERSE,
                cursor: 0,
                batchSize: 0,
                isCaptured: never,
            })
        ).toEqual({ picks: [], skipped: 0, examined: 0 });
    });
});
