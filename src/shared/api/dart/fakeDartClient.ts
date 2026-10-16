import { strToU8, zipSync } from 'fflate';
import { kstDateKey, kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';
import type {
    DartClient,
    DartDisclosureDetailType,
    DartListPage,
    DartListQuery,
    DartRecord,
} from './dartClient';

/**
 * E2E·테스트용 가짜 DART — 네트워크 없이 `DartClient` 모양을 그대로 흉내 낸다. 응답 행은 OpenDART 개발가이드
 * (2019001 공시검색·2019018 고유번호·2019021 대량보유·2019022 임원·주요주주, 2026-10-16 확인)의 필드 형식을 따른다:
 * 수량은 쉼표 문자열, 빈 값은 `-`, `majorstock`의 `rcept_dt`는 `YYYYMMDD`, `elestock`은 `YYYY-MM-DD`.
 *
 * 키가 없어도 켜져 있다(`isEnabled()` 참) — E2E에서 수집 경로를 끝까지 돌리기 위한 것이다. 운영 경로는 `isE2E()`일 때만
 * 이 가짜를 고른다(`dart-corp-code`·`dart-filings` cron의 `createDeps.ts`).
 */
export interface FakeDartData {
    /** `corpCode.xml` 안의 `<list>` 행들. */
    corpCodes: readonly {
        corpCode: string;
        corpName: string;
        stockCode: string;
    }[];
    /** 상세 유형별 공시검색 행(페이지 나눔은 가짜가 한다). */
    disclosures: Readonly<
        Partial<Record<DartDisclosureDetailType, readonly DartRecord[]>>
    >;
    majorStock: Readonly<Record<string, readonly DartRecord[]>>;
    executiveStock: Readonly<Record<string, readonly DartRecord[]>>;
}

/** 원천의 두 날짜 형식 — `YYYYMMDD`(majorstock·list)와 `YYYY-MM-DD`(elestock). */
const compact = (isoDate: string): string => isoDate.replaceAll('-', '');

/**
 * 삼성전자(가이드 예시 고유번호 `00126380`)와 우선주 매핑 확인용 한화(`000880` ↔ `00088K`). 접수일은 **`now`의 KST 날짜 기준
 * 상대값**이다(대량보유·소유보고 1일 전, 거래계획 2일 전) — 수집기의 첫 공시검색 창(D001·D002 7일, D005 89일) 안에 늘 들어가
 * 실행 날짜와 무관하게 같은 결과가 나온다. 접수번호도 그 날짜에서 만든다(`YYYYMMDD` + 일련번호 6자리).
 */
export function buildFakeDartData(now: Date): FakeDartData {
    const today = kstDateKey(now);
    const filed = kstDateKeyDaysBefore(today, 1);
    const planned = kstDateKeyDaysBefore(today, 2);
    const majorReceipt = `${compact(filed)}000123`;
    const insiderReceipt = `${compact(filed)}000456`;
    const planReceipt = `${compact(planned)}000789`;
    return {
        corpCodes: [
            { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930' },
            { corpCode: '00160843', corpName: '한화', stockCode: '000880' },
            // 비상장 법인 — stock_code가 공백이라 맵에 들어가면 안 된다.
            { corpCode: '00434003', corpName: '다코', stockCode: ' ' },
        ],
        disclosures: {
            D001: [
                {
                    corp_cls: 'Y',
                    corp_name: '삼성전자',
                    corp_code: '00126380',
                    stock_code: '005930',
                    report_nm: '주식등의대량보유상황보고서(일반)',
                    rcept_no: majorReceipt,
                    flr_nm: '국민연금공단',
                    rcept_dt: compact(filed),
                    rm: '',
                },
            ],
            D002: [
                {
                    corp_cls: 'Y',
                    corp_name: '한화',
                    corp_code: '00160843',
                    stock_code: '000880',
                    report_nm: '임원ㆍ주요주주특정증권등소유상황보고서',
                    rcept_no: insiderReceipt,
                    flr_nm: '김임원',
                    rcept_dt: compact(filed),
                    rm: '',
                },
            ],
            D005: [
                {
                    corp_cls: 'Y',
                    corp_name: '삼성전자',
                    corp_code: '00126380',
                    stock_code: '005930',
                    report_nm: '임원ㆍ주요주주특정증권등거래계획보고서',
                    rcept_no: planReceipt,
                    flr_nm: '이임원',
                    rcept_dt: compact(planned),
                    rm: '',
                },
            ],
        },
        majorStock: {
            '00126380': [
                {
                    rcept_no: majorReceipt,
                    rcept_dt: compact(filed),
                    corp_code: '00126380',
                    corp_name: '삼성전자',
                    report_tp: '일반',
                    repror: '국민연금공단',
                    stkqy: '432,154,213',
                    stkqy_irds: '-5,120,000',
                    stkrt: '7.24',
                    stkrt_irds: '-0.09',
                    ctr_stkqy: '-',
                    ctr_stkrt: '-',
                    report_resn: '보유주식등의 수 변동',
                },
            ],
        },
        executiveStock: {
            '00160843': [
                {
                    rcept_no: insiderReceipt,
                    rcept_dt: filed,
                    corp_code: '00160843',
                    corp_name: '한화',
                    repror: '김임원',
                    isu_exctv_rgist_at: '등기임원',
                    isu_exctv_ofcps: '대표이사',
                    isu_main_shrholdr: '-',
                    sp_stock_lmp_cnt: '12,500',
                    sp_stock_lmp_irds_cnt: '2,500',
                    sp_stock_lmp_rate: '0.02',
                    sp_stock_lmp_irds_rate: '0.00',
                },
            ],
        },
    };
}

const PAGE_SIZE = 100;

function corpCodeXml(rows: FakeDartData['corpCodes']): string {
    const lists = rows
        .map(
            row =>
                `<list><corp_code>${row.corpCode}</corp_code><corp_name>${row.corpName}</corp_name>` +
                `<corp_eng_name>${row.corpName}</corp_eng_name><stock_code>${row.stockCode}</stock_code>` +
                `<modify_date>20261001</modify_date></list>`
        )
        .join('');
    return `<?xml version="1.0" encoding="UTF-8"?><result>${lists}</result>`;
}

/** 공시 행의 접수일(`YYYYMMDD`)이 질의 기간 안인가. */
function withinRange(row: DartRecord, query: DartListQuery): boolean {
    const date = typeof row.rcept_dt === 'string' ? row.rcept_dt : '';
    return (
        date >= query.beginDate.replaceAll('-', '') &&
        date <= query.endDate.replaceAll('-', '')
    );
}

export interface FakeDartClient extends DartClient {
    /** 받은 호출(엔드포인트 이름) — 테스트가 요청 수를 단언한다. */
    readonly calls: string[];
}

export interface FakeDartClientOptions {
    /** 기본 데이터(`buildFakeDartData`)의 기준 시각. 호출 **시점마다** 읽는다. 기본은 실제 시계. */
    now?: () => Date;
}

/**
 * `data`를 응답으로 쓰는 가짜 DART. 호출마다 `calls`에 엔드포인트를 남긴다. `data`를 주지 않으면 호출 시점의 `now()` 기준
 * 상대 날짜 데이터(`buildFakeDartData`)를 쓴다 — 고정 날짜를 박으면 실제 기간 필터 때문에 달력이 지나면 E2E가 빈 결과가 된다.
 */
export function createFakeDartClient(
    data?: FakeDartData,
    options: FakeDartClientOptions = {}
): FakeDartClient {
    const calls: string[] = [];
    const now = options.now ?? (() => new Date());
    const current = (): FakeDartData => data ?? buildFakeDartData(now());
    return {
        calls,
        isEnabled: () => true,
        fetchCorpCodeZip: async () => {
            calls.push('corpCode.xml');
            return zipSync({
                'CORPCODE.xml': strToU8(corpCodeXml(current().corpCodes)),
            });
        },
        fetchDisclosureList: async (
            query: DartListQuery
        ): Promise<DartListPage> => {
            calls.push('list.json');
            const rows = (current().disclosures[query.detailType] ?? []).filter(
                row => withinRange(row, query)
            );
            const start = (query.pageNo - 1) * PAGE_SIZE;
            return {
                pageNo: query.pageNo,
                totalPage: Math.ceil(rows.length / PAGE_SIZE),
                totalCount: rows.length,
                rows: rows.slice(start, start + PAGE_SIZE),
            };
        },
        fetchMajorStock: async corpCode => {
            calls.push('majorstock.json');
            return [...(current().majorStock[corpCode] ?? [])];
        },
        fetchExecutiveStock: async corpCode => {
            calls.push('elestock.json');
            return [...(current().executiveStock[corpCode] ?? [])];
        },
    };
}
