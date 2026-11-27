import { describe, expect, it } from 'vitest';
import {
    assertKrCount,
    buildKrSnapshot,
    decodeCsvBytes,
    parseEtfHoldingsJson,
    parseKrxCsv,
    parseKrxIndexJson,
    renderKrSnapshotFile,
} from '../signal-universe/krIndexSource';

const codes = (prefix: string, n: number): { code: string; name: string }[] =>
    Array.from({ length: n }, (_, i) => ({
        code: `${prefix}${String(i).padStart(5 - prefix.length + 1, '0')}`.slice(
            0,
            6
        ),
        name: `종목${prefix}${i}`,
    }));
const KOSPI_200 = codes('1', 200);
const KOSDAQ_150 = codes('2', 150);

describe('parseKrxIndexJson', () => {
    it('OutBlock_1의 코드와 이름을 읽는다', () => {
        expect(
            parseKrxIndexJson({
                OutBlock_1: [{ ISU_SRT_CD: '005930', ISU_ABBRV: '삼성전자' }],
            })
        ).toEqual([{ code: '005930', name: '삼성전자' }]);
    });

    it.each([['LOGOUT'], [{}], [{ OutBlock_1: [] }], [{ OutBlock_1: [{}] }]])(
        '형식이 다르면 던진다 (%j)',
        input => {
            expect(() => parseKrxIndexJson(input)).toThrow();
        }
    );
});

describe('parseEtfHoldingsJson', () => {
    const json = {
        pdf: {
            gijunYMD: '20261120',
            list: [
                { itmNo: 'KRD010010001', secNm: '원화예금' },
                { itmNo: '005930', secNm: '삼성전자' },
                { itmNo: '0126Z0', secNm: '삼성에피스홀딩스' },
            ],
        },
    };

    it('종목이 아닌 줄을 버리고 영문 섞인 신규 코드를 받는다', () => {
        expect(parseEtfHoldingsJson(json)).toEqual({
            rows: [
                { code: '005930', name: '삼성전자' },
                { code: '0126Z0', name: '삼성에피스홀딩스' },
            ],
            holdingsDate: '2026-11-20',
        });
    });

    it('목록이나 기준일이 없으면 던진다', () => {
        expect(() => parseEtfHoldingsJson({ pdf: {} })).toThrow();
        expect(() => parseEtfHoldingsJson(null)).toThrow();
    });
});

describe('parseKrxCsv / decodeCsvBytes', () => {
    it('열 이름으로 코드와 이름을 읽고 따옴표 칸을 푼다', () => {
        const csv =
            '﻿"종목코드","종목명","현재가"\r\n"005930","삼성전자","1"\r\n000660,SK하이닉스,2\r\n';
        expect(parseKrxCsv(csv)).toEqual([
            { code: '005930', name: '삼성전자' },
            { code: '000660', name: 'SK하이닉스' },
        ]);
    });

    it('필수 열이 없거나 빈 파일이면 던진다', () => {
        expect(() => parseKrxCsv('코드,이름\n1,2')).toThrow(/column missing/);
        expect(() => parseKrxCsv('')).toThrow(/empty/);
        expect(() => parseKrxCsv('종목코드,종목명\n005930,')).toThrow(
            /without code or name/
        );
    });

    it('UTF-8이 아니면 EUC-KR로 읽는다', () => {
        const eucKr = new Uint8Array([0xbb, 0xef, 0xbc, 0xba]); // 삼성
        expect(decodeCsvBytes(eucKr)).toBe('삼성');
        expect(decodeCsvBytes(new TextEncoder().encode('삼성'))).toBe('삼성');
    });
});

describe('assertKrCount', () => {
    it('공식 목록은 정확히, 프록시는 ±5까지 받는다', () => {
        expect(() => assertKrCount('kospi200', 200, true)).not.toThrow();
        expect(() => assertKrCount('kospi200', 201, true)).toThrow();
        expect(() => assertKrCount('kospi200', 205, false)).not.toThrow();
        expect(() => assertKrCount('kosdaq150', 156, false)).toThrow();
    });
});

describe('buildKrSnapshot', () => {
    const base = {
        asOf: '2026-11-22',
        sourceDetail: 'test',
        kospiRows: KOSPI_200,
        kosdaqRows: KOSDAQ_150,
    };

    it('접미사를 붙이고 코드 순으로 정렬한다', () => {
        const snapshot = buildKrSnapshot({ ...base, sourceKind: 'krx' });
        expect(snapshot.kospi200).toHaveLength(200);
        expect(snapshot.kosdaq150).toHaveLength(150);
        expect(snapshot.kospi200.every(c => c.symbol.endsWith('.KS'))).toBe(
            true
        );
        expect(snapshot.kosdaq150.every(c => c.symbol.endsWith('.KQ'))).toBe(
            true
        );
    });

    it('공식 출처에서 개수가 다르면 던지고, 프록시는 허용 폭 안이면 받는다', () => {
        const plusOne = [...KOSPI_200, { code: '199999', name: '추가' }];
        expect(() =>
            buildKrSnapshot({ ...base, kospiRows: plusOne, sourceKind: 'krx' })
        ).toThrow(/kospi200/);
        expect(
            buildKrSnapshot({
                ...base,
                kospiRows: plusOne,
                sourceKind: 'etf-proxy',
            }).kospi200
        ).toHaveLength(201);
    });

    it('두 목록에 같은 코드가 있으면 던진다', () => {
        const dup = [...KOSDAQ_150.slice(1), KOSPI_200[0] ?? KOSDAQ_150[0]];
        expect(() =>
            buildKrSnapshot({
                ...base,
                kosdaqRows: dup.flatMap(row => (row ? [row] : [])),
                sourceKind: 'csv',
            })
        ).toThrow(/both kospi200 and kosdaq150/);
    });

    it('단축코드 형상이 아니거나 한 목록 안에서 중복이면 던진다', () => {
        expect(() =>
            buildKrSnapshot({
                ...base,
                kospiRows: [{ code: 'ABC', name: 'x' }],
                sourceKind: 'csv',
            })
        ).toThrow(/unexpected stock code/);
        expect(() =>
            buildKrSnapshot({
                ...base,
                kospiRows: [
                    ...KOSPI_200,
                    KOSPI_200[0] ?? { code: '1', name: '' },
                ],
                sourceKind: 'etf-proxy',
            })
        ).toThrow(/duplicate stock code/);
    });
});

describe('renderKrSnapshotFile', () => {
    const snapshot = buildKrSnapshot({
        asOf: '2026-11-22',
        sourceKind: 'etf-proxy',
        sourceDetail: "KODEX 'test'",
        kospiRows: KOSPI_200,
        kosdaqRows: KOSDAQ_150,
    });

    it('프록시 표시와 출처·기준일·개수를 남긴다', () => {
        const file = renderKrSnapshotFile(snapshot, 'yarn signal-universe:kr');
        expect(file).toContain('proxy: true');
        expect(file).toContain("source: 'etf-proxy'");
        expect(file).toContain('코스피 200 200종목, 코스닥 150 150종목');
        expect(file).toContain("KODEX \\'test\\'");
        expect(file).toContain("symbol: '100000.KS'");
    });

    it('공식 목록이면 proxy: false다', () => {
        const official = buildKrSnapshot({
            asOf: '2026-11-22',
            sourceKind: 'krx',
            sourceDetail: 'krx',
            kospiRows: KOSPI_200,
            kosdaqRows: KOSDAQ_150,
        });
        expect(renderKrSnapshotFile(official, 'cmd')).toContain('proxy: false');
    });
});
