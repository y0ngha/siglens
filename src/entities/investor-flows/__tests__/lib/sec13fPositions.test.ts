import { describe, expect, it } from 'vitest';
import {
    streamXmlElements,
    type XmlElement,
} from '@/shared/lib/streamXmlElements';
import {
    PositionAccumulator,
    normalizeCusip,
    toOptionPositionRow,
    toPositionRow,
} from '../../lib/sec13fPositions';
import {
    INFO_TABLE_OPTIONS_SAMPLE,
    INFO_TABLE_PREFIXED,
    INFO_TABLE_SAMPLE,
    INFO_TABLE_ZERO_SHARES_ROW,
} from '../fixtures/investorFlowsSamples';

const ABBOTT = '002824100';
const MSFT = '594918104';
const NVDA = '67066G104';
const UNIVERSE = new Set([ABBOTT, MSFT, NVDA]);

async function rows(xml: string): Promise<XmlElement[]> {
    const found: XmlElement[] = [];
    await streamXmlElements([xml], 'infoTable', el => found.push(el));
    return found;
}

describe('normalizeCusip', () => {
    it('uppercases and strips whitespace', () => {
        expect(normalizeCusip(' 67066g 104 ')).toBe(NVDA);
    });

    it('rejects values that are not nine alphanumerics', () => {
        expect(normalizeCusip('1234')).toBeNull();
        expect(normalizeCusip(undefined)).toBeNull();
        expect(normalizeCusip('12345678!')).toBeNull();
    });
});

describe('toPositionRow', () => {
    it('keeps a universe SH row with its share count and dollar value', async () => {
        const [abbott] = await rows(INFO_TABLE_SAMPLE);
        expect(toPositionRow(abbott as XmlElement, UNIVERSE)).toEqual({
            cusip: ABBOTT,
            shares: 19357,
            valueUsd: 1912972,
        });
    });

    it('drops options (putCall present)', async () => {
        const all = await rows(INFO_TABLE_SAMPLE);
        const put = all.find(r => r.children.some(c => c.name === 'putCall'));
        expect(put).toBeDefined();
        expect(toPositionRow(put as XmlElement, UNIVERSE)).toBeNull();
    });

    it('drops PRN (principal amount) rows', async () => {
        const all = await rows(INFO_TABLE_SAMPLE);
        const nvda = all.find(r =>
            r.children.some(c => c.name === 'cusip' && c.text === NVDA)
        );
        expect(toPositionRow(nvda as XmlElement, UNIVERSE)).toBeNull();
    });

    it('drops CUSIPs outside the universe', async () => {
        const all = await rows(INFO_TABLE_SAMPLE);
        const other = all.find(r =>
            r.children.some(c => c.name === 'cusip' && c.text === 'ZZZZZZZZ9')
        );
        expect(toPositionRow(other as XmlElement, UNIVERSE)).toBeNull();
    });

    it('drops zero-share rows', async () => {
        const [zero] = await rows(INFO_TABLE_ZERO_SHARES_ROW);
        expect(toPositionRow(zero as XmlElement, UNIVERSE)).toBeNull();
    });

    it('reads ns1:-prefixed documents', async () => {
        const [amzn] = await rows(INFO_TABLE_PREFIXED);
        expect(
            toPositionRow(amzn as XmlElement, new Set(['023135106']))
        ).toEqual({ cusip: '023135106', shares: 25000, valueUsd: 22163500 });
    });
});

describe('PositionAccumulator', () => {
    async function accumulate(): Promise<PositionAccumulator> {
        const acc = new PositionAccumulator(UNIVERSE);
        await streamXmlElements([INFO_TABLE_SAMPLE], 'infoTable', el =>
            acc.add(el)
        );
        return acc;
    }

    it('sums duplicate (cusip) rows of one filing', async () => {
        const msft = (await accumulate()).toRows().find(r => r.cusip === MSFT);
        // 6795 + 5 shares, 3485841 + 2000 dollars
        expect(msft).toEqual({ cusip: MSFT, shares: 6800, valueUsd: 3487841 });
    });

    it('keeps only SH, non-option, universe rows (the real NVDA row stays, its PRN variant goes)', async () => {
        const acc = await accumulate();
        expect(
            acc
                .toRows()
                .map(r => r.cusip)
                .sort()
        ).toEqual([ABBOTT, MSFT, NVDA]);
    });

    it('counts rows seen vs kept', async () => {
        const acc = await accumulate();
        // 4 stock rows + the MSFT put row (options are kept as option positions now)
        expect({ seen: acc.rowsSeen, kept: acc.rowsKept }).toEqual({
            seen: 7,
            kept: 5,
        });
    });

    it('keeps the MSFT put row as an option position, not a stock position', async () => {
        const acc = await accumulate();
        expect(acc.toOptionRows()).toEqual([
            { cusip: MSFT, putCall: 'put', shares: 6795, valueUsd: 3485841 },
        ]);
    });
});

const AAPL = '037833100';

describe('toOptionPositionRow', () => {
    it('reads a real Call row as underlying shares and notional', async () => {
        const [call] = await rows(INFO_TABLE_OPTIONS_SAMPLE);
        expect(
            toOptionPositionRow(call as XmlElement, new Set([AAPL]))
        ).toEqual({
            cusip: AAPL,
            putCall: 'call',
            shares: 38600,
            valueUsd: 11169296,
        });
    });

    it('returns null for a stock row (no putCall)', async () => {
        const [, stock] = await rows(INFO_TABLE_OPTIONS_SAMPLE);
        expect(
            toOptionPositionRow(stock as XmlElement, new Set([AAPL]))
        ).toBeNull();
    });

    it('returns null for an option on a CUSIP outside the universe', async () => {
        const [call] = await rows(INFO_TABLE_OPTIONS_SAMPLE);
        expect(
            toOptionPositionRow(call as XmlElement, new Set([MSFT]))
        ).toBeNull();
    });

    it('returns null for an unknown putCall value', async () => {
        const [odd] = await rows(
            INFO_TABLE_OPTIONS_SAMPLE.replace(
                '<putCall>Call</putCall>',
                '<putCall>Straddle</putCall>'
            )
        );
        expect(
            toOptionPositionRow(odd as XmlElement, new Set([AAPL]))
        ).toBeNull();
    });
});

describe('PositionAccumulator with real option rows', () => {
    async function accumulateOptions(): Promise<PositionAccumulator> {
        const acc = new PositionAccumulator(new Set([AAPL]));
        await streamXmlElements([INFO_TABLE_OPTIONS_SAMPLE], 'infoTable', el =>
            acc.add(el)
        );
        return acc;
    }

    it('sums put rows and call rows separately per CUSIP', async () => {
        const options = (await accumulateOptions()).toOptionRows();
        expect(options).toHaveLength(2);
        expect(options).toEqual(
            expect.arrayContaining([
                {
                    cusip: AAPL,
                    putCall: 'call',
                    shares: 38600 + 31194700,
                    valueUsd: 11169296 + 9026498392,
                },
                {
                    cusip: AAPL,
                    putCall: 'put',
                    shares: 33100 + 21541000,
                    valueUsd: 9577816 + 6233103760,
                },
            ])
        );
    });

    it('keeps the stock position free of option shares', async () => {
        const { rows: stock } = (await accumulateOptions()).toPositions();
        expect(stock).toEqual([
            {
                cusip: AAPL,
                shares: 7211515 + 84561,
                valueUsd: 2086723980 + 24468571,
            },
        ]);
    });
});
