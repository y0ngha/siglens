import type { Bar } from '@/domain/types';

export const TEST_BAR_BASE_TIME = 1700000000;
export const TEST_BAR_INTERVAL = 60;
export const TEST_BAR_BASE_PRICE = 100;
export const TEST_BAR_VOLUME = 1000;
export const HAMMER_BODY_OFFSET = 3;
export const HAMMER_HIGH_OFFSET = 5;
export const HAMMER_LOW_OFFSET = -15;

export const makeBar = (i: number, overrides?: Partial<Bar>): Bar => ({
    time: TEST_BAR_BASE_TIME + i * TEST_BAR_INTERVAL,
    open: TEST_BAR_BASE_PRICE,
    high: TEST_BAR_BASE_PRICE + 1,
    low: TEST_BAR_BASE_PRICE - 1,
    close: TEST_BAR_BASE_PRICE + 0.5,
    volume: TEST_BAR_VOLUME,
    ...overrides,
});

export const makeHammerBar = (i: number): Bar =>
    makeBar(i, {
        open: TEST_BAR_BASE_PRICE,
        high: TEST_BAR_BASE_PRICE + HAMMER_HIGH_OFFSET,
        low: TEST_BAR_BASE_PRICE + HAMMER_LOW_OFFSET,
        close: TEST_BAR_BASE_PRICE + HAMMER_BODY_OFFSET,
    });

/**
 * Creates a bearish bar (open > close) followed by a bullish engulfing bar.
 * The bullish bar's body completely engulfs the bearish bar's body.
 */
export const makeEngulfingPair = (startIndex: number): [Bar, Bar] => [
    makeBar(startIndex, {
        open: 110,
        high: 115,
        low: 105,
        close: 106,
    }),
    makeBar(startIndex + 1, {
        open: 104,
        high: 120,
        low: 103,
        close: 118,
    }),
];
