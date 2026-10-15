import { describe, expect, it } from 'vitest';
import {
    streamXmlElements,
    type XmlElement,
} from '@/shared/lib/streamXmlElements';
import {
    parseSec13fPrimaryDoc,
    parseSecDate,
    pickSec13fDocuments,
} from '../../lib/sec13fFiling';
import {
    FILING_INDEX_JSON,
    FILING_INDEX_JSON_AMENDMENT,
    PRIMARY_DOC_NEW_HOLDINGS,
    PRIMARY_DOC_ORIGINAL,
    PRIMARY_DOC_RESTATEMENT,
} from '../fixtures/investorFlowsSamples';

async function root(xml: string): Promise<XmlElement> {
    let found: XmlElement | null = null;
    await streamXmlElements([xml], 'edgarSubmission', el => {
        found = el;
    });
    if (found === null) throw new Error('no root');
    return found;
}

describe('pickSec13fDocuments', () => {
    it('picks primary_doc.xml and the infotable from a real filing index', () => {
        expect(pickSec13fDocuments(FILING_INDEX_JSON)).toEqual({
            primaryDoc: 'primary_doc.xml',
            infoTable: 'infotable.xml',
        });
    });

    it('picks a custom-named information table (real amendment filing)', () => {
        expect(pickSec13fDocuments(FILING_INDEX_JSON_AMENDMENT)).toEqual({
            primaryDoc: 'primary_doc.xml',
            infoTable: 'HFSQ22026A.xml',
        });
    });

    it('prefers the largest xml when several non-primary xml files exist', () => {
        const index = {
            directory: {
                item: [
                    { name: 'primary_doc.xml', size: '2000' },
                    { name: 'small.xml', size: '10' },
                    { name: 'big.xml', size: '999' },
                    { name: 'readme.txt', size: '99999' },
                ],
            },
        };
        expect(pickSec13fDocuments(index).infoTable).toBe('big.xml');
    });

    it('returns nulls for malformed input', () => {
        expect(pickSec13fDocuments(null)).toEqual({
            primaryDoc: null,
            infoTable: null,
        });
        expect(pickSec13fDocuments({ directory: { item: 'x' } })).toEqual({
            primaryDoc: null,
            infoTable: null,
        });
    });
});

describe('parseSecDate', () => {
    it('converts MM-DD-YYYY to ISO', () => {
        expect(parseSecDate('09-30-2026')).toBe('2026-09-30');
    });

    it('passes ISO through and rejects garbage', () => {
        expect(parseSecDate('2026-09-30')).toBe('2026-09-30');
        expect(parseSecDate('Sept 30')).toBeNull();
        expect(parseSecDate(null)).toBeNull();
    });
});

describe('parseSec13fPrimaryDoc', () => {
    it('reads an original 13F-HR: period from periodOfReport, filer name from filingManager', async () => {
        expect(parseSec13fPrimaryDoc(await root(PRIMARY_DOC_ORIGINAL))).toEqual(
            {
                submissionType: '13F-HR',
                period: '2026-09-30',
                isAmendment: false,
                amendmentType: null,
                filerName: '15 Wealth Advisors LLC',
                reportType: '13F HOLDINGS REPORT',
            }
        );
    });

    it('reads a NEW HOLDINGS amendment', async () => {
        const meta = parseSec13fPrimaryDoc(
            await root(PRIMARY_DOC_NEW_HOLDINGS)
        );
        expect(meta).toMatchObject({
            submissionType: '13F-HR/A',
            period: '2026-06-30',
            isAmendment: true,
            amendmentType: 'NEW HOLDINGS',
        });
    });

    it('reads a RESTATEMENT amendment', async () => {
        const meta = parseSec13fPrimaryDoc(await root(PRIMARY_DOC_RESTATEMENT));
        expect(meta).toMatchObject({
            submissionType: '13F-HR/A',
            period: '2017-03-31',
            amendmentType: 'RESTATEMENT',
        });
    });

    it('maps an unknown amendment type to null', async () => {
        const xml = PRIMARY_DOC_RESTATEMENT.replace(
            'RESTATEMENT',
            'SOMETHING ELSE'
        );
        expect(parseSec13fPrimaryDoc(await root(xml)).amendmentType).toBeNull();
    });
});
