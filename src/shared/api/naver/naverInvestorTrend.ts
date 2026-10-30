import 'server-only';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';

/**
 * 네이버 증권 모바일 API의 투자자별 일별 매매동향(`/api/stock/{code}/trend`) 어댑터.
 *
 * 공식 API가 아니라 모바일 웹이 쓰는 JSON이다(키 없음). 값이 전부 `'-868,997'`·`'+627,670'` 같은 쉼표·부호 문자열이라
 * 여기서 숫자로 바꾼다. 본문 형태가 어긋나면 **던진다**(실패). 읽을 수 없는 행 몇 개는 버리고 나머지를 쓴다(`parseNaverInvestorTrend`).
 * HTTP 200 `[]`은 실패가 아니라 "데이터 없음"이라 빈 배열을 돌려주고, 호출부가 실패와 구분해 캐시한다. 최신 거래일은 장 마감 뒤(대략 18시 KST 이후)에야 올라오므로 `bizdate`가 가장 큰 행이 곧 "있는 최신 거래일"이다.
 *
 * 수량 단위는 주(shares)다.
 */
const NAVER_TREND_ENDPOINT = 'https://m.stock.naver.com/api/stock';

/** `pageSize` — 20거래일(약 한 달). 합산 창(5·20일)의 상한이다. */
export const NAVER_TREND_PAGE_SIZE = 20;

/** 레포 공통 외부 호출 규약(8~10초)을 따른다. bare `fetch`는 소켓이 멈추면 300초를 기다린다. */
const NAVER_TREND_TIMEOUT_MS = 8_000;

/** 네이버 종목코드 — 6자리 숫자 또는 영문 섞인 신형 코드(`0001A0`). 경로에 들어가므로 형상을 강제한다. */
const NAVER_STOCK_CODE_RE = /^[0-9A-Z]{6}$/;

export interface NaverInvestorTrendRow {
    /** `YYYY-MM-DD`. */
    date: string;
    foreignNet: number;
    institutionNet: number;
    /** 개인 값을 못 읽으면 null. */
    individualNet: number | null;
    close: number | null;
}

/** `'-868,997'`·`'+627,670'`·`'213,500'` → 숫자. 읽지 못하면 null. */
export function parseNaverNumber(raw: unknown): number | null {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replaceAll(',', '').trim();
    if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return null;
    return Number(cleaned);
}

function formatBizdate(raw: unknown): string | null {
    if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function parseRow(item: unknown): NaverInvestorTrendRow | null {
    if (!isPlainRecord(item)) return null;
    const r = item;
    const date = formatBizdate(r.bizdate);
    const foreignNet = parseNaverNumber(r.foreignerPureBuyQuant);
    const institutionNet = parseNaverNumber(r.organPureBuyQuant);
    if (date === null || foreignNet === null || institutionNet === null)
        return null;
    return {
        date,
        foreignNet,
        institutionNet,
        individualNet: parseNaverNumber(r.individualPureBuyQuant),
        close: parseNaverNumber(r.closePrice),
    };
}

/**
 * 본문 → 최신순 행. 배열이 아니면, 또는 비어 있지 않은데 읽히는 행이 하나도 없으면 던진다. 필수 필드(날짜·외국인·기관)를
 * 못 읽는 행은 버리고 개수만 한 번 로그한다. 빈 배열은 빈 결과다("데이터 없음", 실패가 아니다).
 */
export function parseNaverInvestorTrend(
    body: unknown
): NaverInvestorTrendRow[] {
    if (!Array.isArray(body)) throw new Error('naver trend: non-array body');
    const rows = body
        .map(parseRow)
        .filter((r): r is NaverInvestorTrendRow => r !== null);
    if (body.length > 0 && rows.length === 0)
        throw new Error('naver trend: no readable row');
    const dropped = body.length - rows.length;
    if (dropped > 0)
        console.error(`[NaverTrend] dropped ${dropped} unreadable row(s)`);
    // ISO 날짜라 사전순이 곧 시간순이다 — 최신이 앞.
    return rows.toSorted((a, b) => b.date.localeCompare(a.date));
}

/** 종목코드(접미사 없음)의 최근 20거래일 투자자별 순매수. 실패(네트워크·비정상 응답·형태 불일치)는 던진다. */
export async function fetchNaverInvestorTrend(
    stockCode: string,
    signal?: AbortSignal
): Promise<NaverInvestorTrendRow[]> {
    const code = stockCode.toUpperCase();
    if (!NAVER_STOCK_CODE_RE.test(code))
        throw new Error('naver trend: invalid stock code');
    const timeout = AbortSignal.timeout(NAVER_TREND_TIMEOUT_MS);
    const response = await fetch(
        `${NAVER_TREND_ENDPOINT}/${code}/trend?pageSize=${NAVER_TREND_PAGE_SIZE}`,
        {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        }
    );
    if (!response.ok) throw new Error(`naver trend: HTTP ${response.status}`);
    return parseNaverInvestorTrend(await response.json());
}
