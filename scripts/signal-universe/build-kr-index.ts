/**
 * 코스피 200 + 코스닥 150 신호 스캔 대상 스냅샷 생성 (네트워크: 공개 페이지만, 사용자 데이터 없음).
 *
 * 사용법:
 *   yarn signal-universe:kr
 *   yarn signal-universe:kr --kospi200 <csv> --kosdaq150 <csv>   # 운영자가 내려받은 KRX CSV (우선)
 *
 * 순서: CSV 인자 > KRX 공개 엔드포인트 > KODEX ETF 보유 종목(프록시). 어느 출처를 썼는지는 생성 파일 머리말과
 * 콘솔에 남는다. 결과: src/shared/config/signalScanUniverse/krIndexUniverse.generated.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildKrSnapshot,
    decodeCsvBytes,
    parseEtfHoldingsJson,
    parseKrxCsv,
    parseKrxIndexJson,
    renderKrSnapshotFile,
    type KrSnapshotData,
} from './krIndexSource';

const OUTPUT = resolve(
    process.cwd(),
    'src/shared/config/signalScanUniverse/krIndexUniverse.generated.ts'
);
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; universe-snapshot)';

/** KRX 정보데이터시스템 지수 구성종목: 코스피 200 = (indIdx 1, 028), 코스닥 150 = (2, 203). */
const KRX_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
const KRX_PAGE =
    'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010101';

/** 삼성자산운용 KODEX 200(2ETF01)·KODEX 코스닥 150(2ETF54) 보유 종목. */
const ETF_KOSPI200 = { id: '2ETF01', label: 'KODEX 200 (069500)' } as const;
const ETF_KOSDAQ150 = {
    id: '2ETF54',
    label: 'KODEX 코스닥 150 (229200)',
} as const;

function argValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function compactDate(date: Date): string {
    return date.toISOString().slice(0, 10).replaceAll('-', '');
}

async function fetchJson(
    url: string,
    init: RequestInit = {}
): Promise<unknown> {
    const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const text = await res.text();
    // KRX는 거절할 때 JSON이 아닌 `LOGOUT` 한 단어를 돌려준다.
    return JSON.parse(text);
}

async function fetchKrxIndex(indIdx: string, indIdx2: string) {
    const body = new URLSearchParams({
        bld: 'dbms/MDC/STAT/standard/MDCSTAT00601',
        indIdx,
        indIdx2,
        trdDd: compactDate(new Date()),
        money: '1',
        csvxls_isNo: 'false',
    });
    return parseKrxIndexJson(
        await fetchJson(KRX_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: KRX_PAGE,
            },
            body,
        })
    );
}

async function fetchEtfHoldings(etf: { readonly id: string }) {
    const url = `https://www.samsungfund.com/api/v1/kodex/product-pdf/${etf.id}.do?gijunYMD=${new Date()
        .toISOString()
        .slice(0, 10)
        .replaceAll('-', '.')}`;
    return parseEtfHoldingsJson(await fetchJson(url));
}

async function build(asOf: string): Promise<KrSnapshotData> {
    const kospiCsv = argValue('--kospi200');
    const kosdaqCsv = argValue('--kosdaq150');
    if (kospiCsv !== null && kosdaqCsv !== null) {
        return buildKrSnapshot({
            asOf,
            sourceKind: 'csv',
            sourceDetail: 'operator-downloaded KRX CSV (지수구성종목)',
            kospiRows: parseKrxCsv(
                decodeCsvBytes(readFileSync(resolve(kospiCsv)))
            ),
            kosdaqRows: parseKrxCsv(
                decodeCsvBytes(readFileSync(resolve(kosdaqCsv)))
            ),
        });
    }
    try {
        const [kospiRows, kosdaqRows] = await Promise.all([
            fetchKrxIndex('1', '028'),
            fetchKrxIndex('2', '203'),
        ]);
        return buildKrSnapshot({
            asOf,
            sourceKind: 'krx',
            sourceDetail: 'data.krx.co.kr MDCSTAT00601 (지수 구성종목)',
            kospiRows,
            kosdaqRows,
        });
    } catch (error) {
        console.warn(
            '[signal-universe] KRX endpoint unavailable, falling back to ETF holdings (proxy):',
            error instanceof Error ? error.message : error
        );
    }
    const [kospi, kosdaq] = await Promise.all([
        fetchEtfHoldings(ETF_KOSPI200),
        fetchEtfHoldings(ETF_KOSDAQ150),
    ]);
    return buildKrSnapshot({
        asOf,
        sourceKind: 'etf-proxy',
        sourceDetail: `${ETF_KOSPI200.label} + ${ETF_KOSDAQ150.label} holdings via samsungfund.com, holdings date ${kospi.holdingsDate} / ${kosdaq.holdingsDate}`,
        kospiRows: kospi.rows,
        kosdaqRows: kosdaq.rows,
    });
}

async function main(): Promise<void> {
    const asOf = new Date().toISOString().slice(0, 10);
    const snapshot = await build(asOf);
    writeFileSync(
        OUTPUT,
        renderKrSnapshotFile(snapshot, 'yarn signal-universe:kr')
    );
    console.log(
        `[signal-universe] kr: source=${snapshot.sourceKind} kospi200=${snapshot.kospi200.length} kosdaq150=${snapshot.kosdaq150.length} asOf=${asOf} -> ${OUTPUT}`
    );
}

main().catch(error => {
    console.error('[signal-universe] kr failed:', error);
    process.exitCode = 1;
});
