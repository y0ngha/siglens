import { describe, expect, it } from 'vitest';
import {
    DART_REASON_MAX_LENGTH,
    parseCorpCodeXml,
    parseDartDate,
    parseDartNumber,
    parseDartRatio,
    parseDartRegisteredExecutive,
    parseDartReportForm,
    parseDartShares,
    parseDartText,
    parseDisclosureListRows,
    parseExecutiveStockRows,
    parseMajorStockRows,
    toTradingPlanRow,
} from '../../lib/dartParsers';
import {
    CORP_CODE_XML,
    EXECUTIVE_STOCK_LIST,
    MAJOR_STOCK_LIST,
    SAMSUNG_CORP,
    listRow,
} from '../fixtures/dartSamples';

describe('dart field parsers', () => {
    it.each([
        ['432,154,213', 432_154_213],
        ['-25,165,617', -25_165_617],
        ['+3,049', 3_049],
        ['7.24', 7.24],
        ['-0.36', -0.36],
        ['0.00', 0],
        [' 1,000 ', 1_000],
        [42, 42],
    ] as const)('parseDartNumber(%j) = %j', (raw, expected) => {
        expect(parseDartNumber(raw)).toBe(expected);
    });

    it.each(['-', '', '  ', 'N/A', '1,2a', '--5', null, undefined, Number.NaN])(
        'parseDartNumber(%j) is null',
        raw => {
            expect(parseDartNumber(raw)).toBeNull();
        }
    );

    it('parseDartShares keeps whole numbers only', () => {
        expect(parseDartShares('9,999,999,999')).toBe(9_999_999_999);
        expect(parseDartShares('12.5')).toBeNull();
        expect(parseDartShares('-')).toBeNull();
    });

    it('parseDartRatio rejects values numeric(8,4) cannot hold', () => {
        expect(parseDartRatio('9999.9999')).toBe(9999.9999);
        expect(parseDartRatio('10,000')).toBeNull();
        expect(parseDartRatio('-')).toBeNull();
    });

    it('parseDartText maps the "-" and empty markers to null', () => {
        expect(parseDartText(' 사내이사 ')).toBe('사내이사');
        expect(parseDartText('-')).toBeNull();
        expect(parseDartText('')).toBeNull();
        expect(parseDartText(7)).toBeNull();
    });

    it('parseDartDate reads majorstock YYYYMMDD and elestock YYYY-MM-DD alike', () => {
        expect(parseDartDate('20260311')).toBe('2026-03-11');
        expect(parseDartDate('2026-10-02')).toBe('2026-10-02');
    });

    it.each(['20260230', '2026-13-01', '2026/10/02', '261002', '', '-'])(
        'parseDartDate(%j) is null',
        raw => {
            expect(parseDartDate(raw)).toBeNull();
        }
    );

    it('parseDartReportForm maps 일반/약식 and rejects anything else', () => {
        expect(parseDartReportForm('일반')).toBe('detailed');
        expect(parseDartReportForm(' 약식 ')).toBe('abbreviated');
        expect(parseDartReportForm('-')).toBeNull();
        expect(parseDartReportForm('general')).toBeNull();
    });

    it.each([
        ['등기임원', true],
        ['비등기임원', false],
        ['미등기임원', false],
        ['-', null],
        ['', null],
        ['고문', null],
    ] as const)('parseDartRegisteredExecutive(%j) = %j', (raw, expected) => {
        expect(parseDartRegisteredExecutive(raw)).toBe(expected);
    });
});

describe('parseMajorStockRows', () => {
    it('turns majorstock rows into stored rows with numbers, ISO dates and the report form', () => {
        const { rows, skipped } = parseMajorStockRows(
            MAJOR_STOCK_LIST,
            SAMSUNG_CORP
        );
        expect(skipped).toBe(0);
        expect(rows).toEqual([
            {
                rceptNo: '20260311000555',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-03-11',
                reporter: '국민연금공단',
                reportForm: 'detailed',
                shares: 432_154_213,
                sharesChange: -25_165_617,
                ratioPct: 7.24,
                ratioChangePct: -0.36,
                reason: '보유주식등의 수 변동\n- 장내매도',
            },
            {
                rceptNo: '20260105000101',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-01-05',
                reporter: 'BlackRock Fund Advisors',
                reportForm: 'abbreviated',
                shares: 300_610_215,
                sharesChange: 3_049_320,
                ratioPct: 5.03,
                ratioChangePct: 0.05,
                reason: null,
            },
        ]);
    });

    it('skips rows without a valid receipt number, date, reporter or report form', () => {
        const base = MAJOR_STOCK_LIST[0];
        const { rows, skipped } = parseMajorStockRows(
            [
                { ...base, rcept_no: '2026031100055' },
                { ...base, rcept_dt: '2026-02-30' },
                { ...base, repror: '-' },
                { ...base, report_tp: '정정' },
                base,
            ],
            SAMSUNG_CORP
        );
        expect(skipped).toBe(4);
        expect(rows.map(row => row.rceptNo)).toEqual(['20260311000555']);
    });

    it('drops rows of another corp and keeps the last of duplicate (receipt, reporter) rows', () => {
        const base = MAJOR_STOCK_LIST[0];
        const { rows, skipped } = parseMajorStockRows(
            [
                { ...base, corp_code: '00164779' },
                { ...base, stkqy: '1' },
                { ...base, stkqy: '2' },
            ],
            SAMSUNG_CORP
        );
        expect(skipped).toBe(1);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.shares).toBe(2);
    });

    it('caps the free-text reason', () => {
        const { rows } = parseMajorStockRows(
            [
                {
                    ...MAJOR_STOCK_LIST[0],
                    report_resn: '가'.repeat(DART_REASON_MAX_LENGTH + 10),
                },
            ],
            SAMSUNG_CORP
        );
        expect(rows[0]?.reason).toHaveLength(DART_REASON_MAX_LENGTH);
    });
});

describe('parseExecutiveStockRows', () => {
    it('reads registration, position and the major-shareholder relation text', () => {
        const { rows, skipped } = parseExecutiveStockRows(
            EXECUTIVE_STOCK_LIST,
            SAMSUNG_CORP
        );
        expect(skipped).toBe(0);
        expect(rows).toEqual([
            {
                rceptNo: '20261002000321',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-10-02',
                reporter: '홍길동',
                position: '사내이사',
                registered: true,
                majorShareholder: null,
                shares: 12_000,
                sharesChange: 2_000,
                ratioPct: 0,
                ratioChangePct: 0,
            },
            {
                rceptNo: '20260915000222',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-09-15',
                reporter: '삼성생명보험',
                position: null,
                registered: null,
                majorShareholder: '10%이상주주',
                shares: 508_157_148,
                sharesChange: -1_250_000,
                ratioPct: 8.51,
                ratioChangePct: -0.02,
            },
            {
                rceptNo: '20260801000777',
                corpCode: SAMSUNG_CORP,
                receiptDate: '2026-08-01',
                reporter: '김미등',
                position: '상무',
                registered: false,
                majorShareholder: null,
                shares: 1_500,
                sharesChange: null,
                ratioPct: 0,
                ratioChangePct: null,
            },
        ]);
    });

    it('also accepts a compact YYYYMMDD receipt date', () => {
        const { rows } = parseExecutiveStockRows(
            [{ ...EXECUTIVE_STOCK_LIST[0], rcept_dt: '20261002' }],
            SAMSUNG_CORP
        );
        expect(rows[0]?.receiptDate).toBe('2026-10-02');
    });
});

describe('parseDisclosureListRows', () => {
    it('keeps listed stock codes (upper-cased) and nulls blank ones', () => {
        const { rows, skipped } = parseDisclosureListRows([
            listRow(),
            listRow({
                rcept_no: '20261015000124',
                corp_code: '00434003',
                stock_code: ' ',
            }),
            listRow({ rcept_no: '20261015000125', stock_code: '0001a0' }),
        ]);
        expect(skipped).toBe(0);
        expect(rows.map(row => row.stockCode)).toEqual([
            '005930',
            null,
            '0001A0',
        ]);
        expect(rows[0]).toEqual({
            rceptNo: '20261015000123',
            corpCode: SAMSUNG_CORP,
            stockCode: '005930',
            receiptDate: '2026-10-15',
            filer: '홍길동',
            title: '임원ㆍ주요주주특정증권등소유상황보고서',
        });
    });

    it('skips rows without a receipt number, corp code, date, filer or title', () => {
        const { rows, skipped } = parseDisclosureListRows([
            listRow({ rcept_no: 'x' }),
            listRow({ corp_code: '126380' }),
            listRow({ rcept_dt: '' }),
            listRow({ flr_nm: '' }),
            listRow({ report_nm: '-' }),
        ]);
        expect(rows).toEqual([]);
        expect(skipped).toBe(5);
    });

    it('maps a D005 row to a trading plan with the filer as reporter', () => {
        const [row] = parseDisclosureListRows([
            listRow({ report_nm: '임원ㆍ주요주주특정증권등거래계획보고서' }),
        ]).rows;
        expect(row && toTradingPlanRow(row)).toEqual({
            rceptNo: '20261015000123',
            corpCode: SAMSUNG_CORP,
            receiptDate: '2026-10-15',
            reporter: '홍길동',
            title: '임원ㆍ주요주주특정증권등거래계획보고서',
        });
    });
});

describe('parseCorpCodeXml', () => {
    it('keeps only listed companies with a 6-char KRX code (letters allowed)', async () => {
        const { rows, skipped } = await parseCorpCodeXml([CORP_CODE_XML]);
        expect(rows).toEqual([
            {
                stockCode: '005930',
                corpCode: '00126380',
                corpName: '삼성전자',
            },
            { stockCode: '000880', corpCode: '00160843', corpName: '한화' },
            {
                stockCode: '0001A0',
                corpCode: '01799999',
                corpName: '덕양에너젠',
            },
        ]);
        // The blank (unlisted) row is not counted as malformed; the bad corp code is.
        expect(skipped).toBe(1);
    });

    it('keeps the most recently modified row when a stock code repeats', async () => {
        const xml = `<result>
<list><corp_code>00000001</corp_code><corp_name>옛이름</corp_name><stock_code>111110</stock_code><modify_date>20240101</modify_date></list>
<list><corp_code>00000002</corp_code><corp_name>새이름</corp_name><stock_code>111110</stock_code><modify_date>20260101</modify_date></list>
<list><corp_code>00000003</corp_code><corp_name>더옛이름</corp_name><stock_code>111110</stock_code><modify_date>20200101</modify_date></list>
</result>`;
        const { rows } = await parseCorpCodeXml([xml]);
        expect(rows).toEqual([
            { stockCode: '111110', corpCode: '00000002', corpName: '새이름' },
        ]);
    });

    it('reads the document from byte chunks split mid-character', async () => {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(CORP_CODE_XML);
        // 첫 한글 글자(3바이트) 한가운데서 자른다.
        const split =
            encoder.encode(
                CORP_CODE_XML.slice(0, CORP_CODE_XML.indexOf('삼성전자'))
            ).byteLength + 1;
        const { rows } = await parseCorpCodeXml([
            bytes.subarray(0, split),
            bytes.subarray(split),
        ]);
        expect(rows).toHaveLength(3);
    });
});
