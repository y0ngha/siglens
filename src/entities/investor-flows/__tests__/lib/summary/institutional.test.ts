import { describe, expect, it } from 'vitest';
import type { InvestorFlowsScorecard } from '@y0ngha/siglens-core';
import {
    summarizePutCall,
    withPutCallValueReading,
} from '../../../lib/summary/institutional';

/** Only the fields `summarizePutCall` reads; the rest of the scorecard is irrelevant to it. */
function scorecardWith(metrics: {
    optionsPeriod: string | null;
    putCallValueRatio: number | null;
    priorPutCallValueRatio: number | null;
}): InvestorFlowsScorecard {
    return { institutional: { metrics } } as unknown as InvestorFlowsScorecard;
}

describe('summarizePutCall', () => {
    it('no options quarter -> null', () => {
        expect(
            summarizePutCall(
                scorecardWith({
                    optionsPeriod: null,
                    putCallValueRatio: 1.2,
                    priorPutCallValueRatio: null,
                })
            )
        ).toBeNull();
    });

    it('reads the side by underlying notional from the printed ratio', () => {
        expect(
            summarizePutCall(
                scorecardWith({
                    optionsPeriod: '2026-06-30',
                    putCallValueRatio: 1.42,
                    priorPutCallValueRatio: 0.75,
                })
            )
        ).toMatchObject({
            putCallValueRatio: 1.42,
            reading: {
                side: 'more_puts',
                text: '1.42 puts per call by underlying notional (13F): more put exposure than call exposure',
            },
        });
        expect(
            summarizePutCall(
                scorecardWith({
                    optionsPeriod: '2026-06-30',
                    putCallValueRatio: 0.58,
                    priorPutCallValueRatio: null,
                })
            )?.reading
        ).toEqual({
            side: 'more_calls',
            text: '0.58 puts per call by underlying notional (13F): more call exposure than put exposure',
        });
    });

    it('is read from the ROUNDED ratio (4 digits): 1.00004 prints as 1 and reads even', () => {
        const summary = summarizePutCall(
            scorecardWith({
                optionsPeriod: '2026-06-30',
                putCallValueRatio: 1.00004,
                priorPutCallValueRatio: null,
            })
        );
        expect(summary?.putCallValueRatio).toBe(1);
        expect(summary?.reading?.side).toBe('even');
    });

    it('a quarter without a ratio has no reading', () => {
        expect(
            summarizePutCall(
                scorecardWith({
                    optionsPeriod: '2026-06-30',
                    putCallValueRatio: null,
                    priorPutCallValueRatio: null,
                })
            )
        ).toMatchObject({ putCallValueRatio: null, reading: null });
    });
});

describe('withPutCallValueReading', () => {
    it('inserts the reading right after priorPutCallValueRatio and keeps the other keys in place', () => {
        const out = withPutCallValueReading({
            period: '2026-06-30',
            putCallValueRatio: 1.42,
            priorPutCallValueRatio: 0.75,
            note: 'n',
        });
        expect(Object.keys(out)).toEqual([
            'period',
            'putCallValueRatio',
            'priorPutCallValueRatio',
            'reading',
            'note',
        ]);
        expect(out.reading?.side).toBe('more_puts');
    });

    it('recomputes a stale reading and appends one when there is no prior-ratio key', () => {
        const out = withPutCallValueReading({
            putCallValueRatio: 0.5,
            reading: { side: 'more_puts', text: 'stale' },
        });
        expect(out.reading?.side).toBe('more_calls');
        expect(Object.keys(out)).toEqual(['putCallValueRatio', 'reading']);
    });

    it('a null ratio has a null reading', () => {
        expect(
            withPutCallValueReading({ putCallValueRatio: null }).reading
        ).toBeNull();
    });
});
