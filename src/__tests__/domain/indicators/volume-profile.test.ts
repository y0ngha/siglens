import { calculateVolumeProfile } from '@/domain/indicators/volume-profile';
import {
    VP_DEFAULT_ROW_SIZE,
    VP_MIN_BARS,
    VP_VALUE_AREA_PERCENTAGE,
} from '@/domain/indicators/constants';
import type { Bar, VolumeProfileResult } from '@/domain/types';

function makeBars(
    count: number,
    options: {
        open?: number;
        high?: number;
        low?: number;
        close?: number;
        volume?: number;
    } = {}
): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: i,
        open: options.open ?? 100,
        high: options.high ?? 110,
        low: options.low ?? 90,
        close: options.close ?? 100,
        volume: options.volume ?? 1000,
    }));
}

function makeBarsWithRange(
    prices: {
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    }[]
): Bar[] {
    return prices.map((p, i) => ({
        time: i,
        ...p,
    }));
}

describe('Volume Profile', () => {
    describe('calculateVolumeProfile', () => {
        describe('빈 배열이 입력될 때', () => {
            it('null을 반환한다', () => {
                expect(calculateVolumeProfile([])).toBeNull();
            });
        });

        describe('VP_MIN_BARS 미만 입력될 때', () => {
            it('null을 반환한다', () => {
                const bars = makeBars(VP_MIN_BARS - 1);
                expect(calculateVolumeProfile(bars)).toBeNull();
            });
        });

        describe('모든 bars의 high와 low가 동일할 때', () => {
            it('null을 반환한다', () => {
                const bars = makeBars(VP_MIN_BARS, { high: 100, low: 100 });
                expect(calculateVolumeProfile(bars)).toBeNull();
            });
        });

        describe('일부 bar의 high와 low가 동일할 때 (barRange === 0 분기)', () => {
            it('barRange가 0인 bar의 거래량을 해당 가격 버킷에 할당하고 null이 아닌 결과를 반환한다', () => {
                const normalBars = makeBarsWithRange(
                    Array.from({ length: VP_MIN_BARS - 1 }, (_, i) => ({
                        open: 100 + i,
                        high: 110 + i,
                        low: 90 + i,
                        close: 100 + i,
                        volume: 1000,
                    }))
                );
                const flatBar = makeBarsWithRange([
                    {
                        open: 100,
                        high: 100,
                        low: 100,
                        close: 100,
                        volume: 500,
                    },
                ]);
                const bars = [...normalBars, ...flatBar];
                const result = calculateVolumeProfile(bars);
                expect(result).not.toBeNull();
            });
        });

        describe('정상 입력일 때', () => {
            it('VP_MIN_BARS 이상이면 null이 아닌 결과를 반환한다', () => {
                const bars = makeBars(VP_MIN_BARS);
                expect(calculateVolumeProfile(bars)).not.toBeNull();
            });

            it('profile 길이는 기본 rowSize(VP_DEFAULT_ROW_SIZE)와 같다', () => {
                const bars = makeBars(VP_MIN_BARS);
                const result = calculateVolumeProfile(bars);
                expect(result?.profile).toHaveLength(VP_DEFAULT_ROW_SIZE);
            });

            it('rowSize를 지정하면 profile 길이가 해당 rowSize와 같다', () => {
                const bars = makeBars(VP_MIN_BARS);
                const customRowSize = 12;
                const result = calculateVolumeProfile(bars, customRowSize);
                expect(result?.profile).toHaveLength(customRowSize);
            });
        });

        describe('범위 검증', () => {
            it('val <= poc <= vah 관계를 만족한다', () => {
                const bars = makeBars(VP_MIN_BARS);
                const result = calculateVolumeProfile(bars);
                expect(result).not.toBeNull();
                if (result) {
                    expect(result.val).toBeLessThanOrEqual(result.poc);
                    expect(result.poc).toBeLessThanOrEqual(result.vah);
                }
            });

            it('profile의 price는 오름차순 정렬된다', () => {
                const bars = makeBars(VP_MIN_BARS);
                const result: VolumeProfileResult | null =
                    calculateVolumeProfile(bars);
                expect(result).not.toBeNull();
                if (result) {
                    expect(
                        result.profile.every(
                            (row, i) =>
                                i === 0 ||
                                row.price > result.profile[i - 1].price
                        )
                    ).toBe(true);
                }
            });
        });

        describe('POC 위치 검증', () => {
            it('거래량이 특정 가격대에 집중되면 POC가 해당 구간에 위치한다', () => {
                // 고가 구간(150~160)에 거래량 집중
                const highVolumeBars = makeBarsWithRange(
                    Array.from({ length: VP_MIN_BARS }, (_, i) => ({
                        open: 155,
                        high: 160,
                        low: 150,
                        close: 155,
                        volume: i < VP_MIN_BARS / 2 ? 10000 : 100,
                    }))
                );
                // 저가 구간(100~110)에도 몇 개 추가
                const lowVolumeBars = makeBarsWithRange(
                    Array.from({ length: 10 }, () => ({
                        open: 105,
                        high: 110,
                        low: 100,
                        close: 105,
                        volume: 10,
                    }))
                );
                const bars = [...highVolumeBars, ...lowVolumeBars];
                const result = calculateVolumeProfile(bars);
                expect(result).not.toBeNull();
                if (result) {
                    // POC는 고가 구간(150~160)에 있어야 함
                    expect(result.poc).toBeGreaterThan(140);
                }
            });
        });

        describe('Value Area 검증', () => {
            it('Value Area는 전체 거래량의 약 70% 이상을 포함한다', () => {
                const bars = makeBarsWithRange(
                    Array.from({ length: VP_MIN_BARS }, (_, i) => ({
                        open: 100 + i,
                        high: 110 + i,
                        low: 90 + i,
                        close: 100 + i,
                        volume: 1000,
                    }))
                );
                const result: VolumeProfileResult | null =
                    calculateVolumeProfile(bars);
                expect(result).not.toBeNull();
                if (result) {
                    const VALUE_AREA_TOLERANCE = 0.05; // bucket 경계 이산화로 인한 허용 오차
                    const totalVolume = result.profile.reduce(
                        (sum, row) => sum + row.volume,
                        0
                    );
                    const valueAreaVolume = result.profile
                        .filter(
                            row =>
                                result.val <= row.price &&
                                row.price <= result.vah
                        )
                        .reduce((sum, row) => sum + row.volume, 0);

                    expect(
                        valueAreaVolume / totalVolume
                    ).toBeGreaterThanOrEqual(
                        VP_VALUE_AREA_PERCENTAGE - VALUE_AREA_TOLERANCE
                    );
                }
            });
        });
    });
});
