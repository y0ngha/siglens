import { describe, expect, it, vi } from 'vitest';
import type { YahooAnalystSummary } from '@/shared/api/yahoo/yahooAnalystSource';
import {
    classifyYahooGrades,
    readGradesSource,
    resolveGradesConsensus,
    gradeCountsOnly,
    isYahooFailedGrades,
    type YahooGradesResult,
} from '../gradesConsensusSource';

const YAHOO_GRADES = {
    strongBuy: 10,
    buy: 37,
    hold: 14,
    sell: 0,
    strongSell: 0,
};
const FMP_GRADES = { strongBuy: 40, buy: 70, hold: 32, sell: 2, strongSell: 1 };

const DATA: YahooGradesResult = { kind: 'data', grades: YAHOO_GRADES };
const EMPTY: YahooGradesResult = { kind: 'empty' };
const FAILED: YahooGradesResult = { kind: 'failed' };

const summary = (trend: YahooAnalystSummary['trend']): YahooAnalystSummary => ({
    targets: {
        mean: null,
        median: null,
        low: null,
        high: null,
        analysts: null,
    },
    trend,
    actions: null,
    earnings: null,
});

describe('classifyYahooGrades', () => {
    it('null(요약 실패)은 failed', () => {
        expect(classifyYahooGrades(null)).toEqual({ kind: 'failed' });
    });

    it('분포가 없는 요약(ETF·미커버의 캐시된 빈 결과)은 empty', () => {
        expect(classifyYahooGrades(summary(null))).toEqual({ kind: 'empty' });
    });

    it('다섯 건수의 합이 0인 분포도 empty', () => {
        expect(
            classifyYahooGrades(
                summary({
                    strongBuy: 0,
                    buy: 0,
                    hold: 0,
                    sell: 0,
                    strongSell: 0,
                })
            )
        ).toEqual({ kind: 'empty' });
    });

    it('분포가 있으면 다섯 건수만 data로 싣는다', () => {
        expect(classifyYahooGrades(summary(YAHOO_GRADES))).toEqual({
            kind: 'data',
            grades: YAHOO_GRADES,
        });
    });
});

describe('resolveGradesConsensus', () => {
    describe('Yahoo 데이터', () => {
        it.each([
            ['FMP 값이 있어도', FMP_GRADES],
            ['FMP 값이 null이어도', null],
        ])(
            '%s Yahoo 분포를 source: yahoo로 돌려주고 FMP를 부르지 않는다',
            async (_, fmpValue) => {
                const fmp = vi.fn().mockResolvedValue(fmpValue);
                await expect(
                    resolveGradesConsensus(DATA, fmp)
                ).resolves.toEqual({
                    ...YAHOO_GRADES,
                    source: 'yahoo',
                });
                expect(fmp).not.toHaveBeenCalled();
            }
        );
    });

    describe('Yahoo 데이터 없음', () => {
        it('FMP 값을 source: fmp로 돌려준다(실패 표시 없음)', async () => {
            const fmp = vi.fn().mockResolvedValue(FMP_GRADES);
            const value = await resolveGradesConsensus(EMPTY, fmp);
            expect(value).toEqual({ ...FMP_GRADES, source: 'fmp' });
            expect(value).not.toHaveProperty('yahooFailed');
            expect(fmp).toHaveBeenCalledTimes(1);
        });

        it('FMP도 없으면 null', async () => {
            await expect(
                resolveGradesConsensus(EMPTY, async () => null)
            ).resolves.toBeNull();
        });

        it('FMP가 던지면 종전대로 그대로 전파한다', async () => {
            await expect(
                resolveGradesConsensus(EMPTY, async () => {
                    throw new Error('fmp down');
                })
            ).rejects.toThrow('fmp down');
        });
    });

    describe('Yahoo 실패', () => {
        it('던지지 않고 FMP 값을 source: fmp + yahooFailed로 돌려준다', async () => {
            const fmp = vi.fn().mockResolvedValue(FMP_GRADES);
            await expect(resolveGradesConsensus(FAILED, fmp)).resolves.toEqual({
                ...FMP_GRADES,
                source: 'fmp',
                yahooFailed: true,
            });
            expect(fmp).toHaveBeenCalledTimes(1);
        });

        it('FMP 값이 없으면 null', async () => {
            await expect(
                resolveGradesConsensus(FAILED, async () => null)
            ).resolves.toBeNull();
        });

        it('FMP가 던지면 그 오류를 전파한다(종전 동작)', async () => {
            await expect(
                resolveGradesConsensus(FAILED, async () => {
                    throw new Error('fmp down');
                })
            ).rejects.toThrow('fmp down');
        });
    });
});

describe('isYahooFailedGrades', () => {
    it('yahooFailed 표시가 있을 때만 true', () => {
        expect(
            isYahooFailedGrades({ ...FMP_GRADES, yahooFailed: true } as never)
        ).toBe(true);
        expect(
            isYahooFailedGrades({ ...FMP_GRADES, source: 'fmp' } as never)
        ).toBe(false);
        expect(isYahooFailedGrades(FMP_GRADES)).toBe(false);
        expect(isYahooFailedGrades(null)).toBe(false);
    });
});

describe('gradeCountsOnly', () => {
    it('다섯 건수만 남기고 source·yahooFailed를 벗긴다', () => {
        expect(
            gradeCountsOnly({
                ...FMP_GRADES,
                source: 'fmp',
                yahooFailed: true,
            } as never)
        ).toEqual(FMP_GRADES);
    });
});

describe('readGradesSource', () => {
    it('yahoo·fmp 표시를 읽는다', () => {
        expect(
            readGradesSource({ ...YAHOO_GRADES, source: 'yahoo' } as never)
        ).toBe('yahoo');
        expect(
            readGradesSource({ ...FMP_GRADES, source: 'fmp' } as never)
        ).toBe('fmp');
    });

    it('표시가 없거나 모르는 값, null은 null', () => {
        expect(readGradesSource(YAHOO_GRADES)).toBeNull();
        expect(
            readGradesSource({ ...YAHOO_GRADES, source: 'x' } as never)
        ).toBeNull();
        expect(readGradesSource(null)).toBeNull();
    });
});
