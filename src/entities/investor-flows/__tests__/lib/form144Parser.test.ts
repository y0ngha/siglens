import { describe, expect, it } from 'vitest';
import { parseForm144Xml, parseUsSlashDate } from '../../lib/form144Parser';
import {
    FORM144_AMD_NS2,
    FORM144_TRU_COM,
} from '../fixtures/investorFlowsExpansionSamples';

describe('parseUsSlashDate', () => {
    it('converts MM/DD/YYYY to an ISO date', () => {
        expect(parseUsSlashDate('10/15/2026')).toBe('2026-10-15');
    });

    it('returns null for other shapes', () => {
        expect(parseUsSlashDate('2026-10-15')).toBeNull();
        expect(parseUsSlashDate(null)).toBeNull();
    });
});

describe('parseForm144Xml', () => {
    describe('real AMD filing (ns2: address prefix)', () => {
        it('reads the proposed sale', async () => {
            expect(await parseForm144Xml(FORM144_AMD_NS2)).toEqual({
                issuerCik: '0000002488',
                issuerName: 'ADVANCED MICRO DEVICES, INC.',
                filerName: 'FORREST E NORROD',
                filerCik: '0001622864',
                relationships: ['Officer'],
                securityClass: 'Common',
                shares: 17262,
                valueUsd: 9333573,
                sharesOutstanding: 1632475042,
                approxSaleDate: '2026-10-15',
                planAdoptionDate: '2026-05-20',
                broker: 'Morgan Stanley Smith Barney LLC Executive Financial Services',
            });
        });
    });

    describe('real TransUnion filing (com: address prefix, 10b5-1 plan)', () => {
        it('reads the issuer and amounts regardless of the prefix', async () => {
            expect(await parseForm144Xml(FORM144_TRU_COM)).toMatchObject({
                issuerCik: '0001552033',
                filerName: 'Abdelsadek Mohamed',
                filerCik: '0002058648',
                shares: 500,
                valueUsd: 35000,
                broker: 'Fidelity Brokerage Services LLC',
            });
        });

        it('reads its 10b5-1 plan adoption date', async () => {
            expect(
                (await parseForm144Xml(FORM144_TRU_COM))?.planAdoptionDate
            ).toBe('2026-06-11');
        });
    });

    describe('filer CIK (headerData/filerInfo/filer/filerCredentials/cik)', () => {
        it('zero-pads a short CIK to 10 digits', async () => {
            const xml = FORM144_TRU_COM.replace(
                '<cik>0002058648</cik>',
                '<cik>2058648</cik>'
            );
            expect((await parseForm144Xml(xml))?.filerCik).toBe('0002058648');
        });

        it('reads it under a prefixed namespace too', async () => {
            const xml = FORM144_TRU_COM.replace(
                '<cik>0002058648</cik>',
                '<com:cik>0002058648</com:cik>'
            );
            expect((await parseForm144Xml(xml))?.filerCik).toBe('0002058648');
        });

        it('is null when the header has no CIK or it is not numeric (the filing is still parsed)', async () => {
            const noHeader = FORM144_TRU_COM.replace(
                /<headerData>[\s\S]*<\/headerData>/,
                ''
            );
            const parsedNoHeader = await parseForm144Xml(noHeader);
            expect(parsedNoHeader?.filerCik).toBeNull();
            expect(parsedNoHeader?.filerName).toBe('Abdelsadek Mohamed');
            const bad = FORM144_TRU_COM.replace(
                '<cik>0002058648</cik>',
                '<cik>ABC</cik>'
            );
            expect((await parseForm144Xml(bad))?.filerCik).toBeNull();
        });
    });

    describe('derived variants', () => {
        it('sums repeated securitiesInformation blocks and keeps the earliest sale date', async () => {
            const block = FORM144_TRU_COM.slice(
                FORM144_TRU_COM.indexOf('<securitiesInformation>'),
                FORM144_TRU_COM.indexOf('</securitiesInformation>') +
                    '</securitiesInformation>'.length
            );
            const second = block
                .replace(
                    '<noOfUnitsSold>500</noOfUnitsSold>',
                    '<noOfUnitsSold>1,200</noOfUnitsSold>'
                )
                .replace(
                    '<aggregateMarketValue>35000.00</aggregateMarketValue>',
                    '<aggregateMarketValue>84000.40</aggregateMarketValue>'
                )
                .replace(
                    '<approxSaleDate>10/15/2026</approxSaleDate>',
                    '<approxSaleDate>10/14/2026</approxSaleDate>'
                );
            const doubled = FORM144_TRU_COM.replace(block, block + second);
            expect(await parseForm144Xml(doubled)).toMatchObject({
                shares: 1700,
                valueUsd: 119000,
                approxSaleDate: '2026-10-14',
            });
        });

        it('keeps the latest of several plan adoption dates', async () => {
            const twoPlans = FORM144_AMD_NS2.replace(
                '<planAdoptionDate>05/20/2026</planAdoptionDate>',
                '<planAdoptionDate>05/20/2026</planAdoptionDate><planAdoptionDate>08/01/2026</planAdoptionDate>'
            );
            expect((await parseForm144Xml(twoPlans))?.planAdoptionDate).toBe(
                '2026-08-01'
            );
        });

        it('has no plan adoption date when the filing gives none', async () => {
            const noPlan = FORM144_TRU_COM.replace(
                /<planAdoptionDates>[\s\S]*?<\/planAdoptionDates>/,
                ''
            );
            expect(
                (await parseForm144Xml(noPlan))?.planAdoptionDate
            ).toBeNull();
        });

        it('returns null when the sale amount is missing', async () => {
            const noValue = FORM144_TRU_COM.replace(
                '<aggregateMarketValue>35000.00</aggregateMarketValue>',
                ''
            );
            expect(await parseForm144Xml(noValue)).toBeNull();
        });

        it('returns null when the issuer CIK is missing', async () => {
            const noIssuer = FORM144_TRU_COM.replace(
                '<issuerCik>0001552033</issuerCik>',
                ''
            );
            expect(await parseForm144Xml(noIssuer)).toBeNull();
        });

        it('returns null for a document without edgarSubmission', async () => {
            expect(await parseForm144Xml('<other/>')).toBeNull();
        });
    });
});
