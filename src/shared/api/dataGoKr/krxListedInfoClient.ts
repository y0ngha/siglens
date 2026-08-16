import 'server-only';

/**
 * 공공데이터포털 — 금융위원회 KRX상장종목정보.
 *
 * https://www.data.go.kr/data/15094775/openapi.do
 *
 * 이 소스를 쓰는 이유: **yahoo `search`가 한글 질의를 거부**하기 때문이다
 * (`BadRequestError: Invalid Search Query`, 2026-08-16 실측). 한국 사용자가 "삼성전자"로
 * 검색하는 가장 자연스러운 경로를 yahoo로는 절대 열 수 없어, 한글 종목명 마스터를
 * 자체 보유해야 한다.
 *
 * KRX Data Marketplace(`data-dbg.krx.co.kr`) 대신 이쪽을 고른 근거:
 * - 상업 이용이 "이용허락범위 제한 없음"으로 **명문화**되어 있다
 * - 운영 계정 트래픽이 10만 콜/일로 넉넉하다
 * - 응답에 단축코드·ISIN·시장구분·한글 종목명이 모두 들어 있다
 *
 * 갱신은 일 1회(기준일 다음 영업일 13시 이후)이므로 시드도 하루 1회면 충분하다.
 */

const ENDPOINT =
    'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo';

/** API가 허용하는 페이지당 최대 행 수. */
const MAX_ROWS_PER_PAGE = 1000;

/** 폭주 방지 상한 — KOSPI+KOSDAQ+KONEX 전체가 3,000 종목 남짓이라 넉넉하다. */
const MAX_PAGES = 20;

/** 시장 구분 값. `mrktCtg` 필드가 이 셋 중 하나로 온다. */
export type KrxMarket = 'KOSPI' | 'KOSDAQ' | 'KONEX';

export interface KrxListedItem {
    /** 단축코드 6자리(예: `005930`). 거래소 접미사는 붙어 있지 않다. */
    shortCode: string;
    /** 한글 종목명(예: `삼성전자`). */
    koreanName: string;
    /** 시장 구분. */
    market: KrxMarket;
    /** ISIN 12자리. */
    isin: string;
    /** 법인명(한글). 종목명과 다를 수 있다(우선주·ETF 등). */
    corpName: string;
}

interface RawItem {
    srtnCd?: string;
    itmsNm?: string;
    mrktCtg?: string;
    isinCd?: string;
    corpNm?: string;
}

interface RawResponse {
    response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: {
            totalCount?: number;
            items?: { item?: RawItem[] } | RawItem[];
        };
    };
}

/** 성공 코드. 공공데이터포털은 HTTP 200에 에러 코드를 실어 보내는 경우가 있다. */
const RESULT_CODE_OK = '00';

function serviceKey(): string | null {
    return process.env.DATA_GO_KR_SERVICE_KEY || null;
}

/** 자격증명 유무 — 시드 스크립트와 호출부가 사전 확인에 쓴다. */
export function hasDataGoKrCredentials(): boolean {
    return serviceKey() !== null;
}

function toMarket(raw: string | undefined): KrxMarket | null {
    // 응답 표기가 'KOSPI'/'KOSDAQ'/'KONEX'로 오지만 공백·대소문자 변형을 방어한다.
    const v = raw?.trim().toUpperCase();
    return v === 'KOSPI' || v === 'KOSDAQ' || v === 'KONEX' ? v : null;
}

function toItem(raw: RawItem): KrxListedItem[] {
    const shortCode = raw.srtnCd?.trim();
    const koreanName = raw.itmsNm?.trim();
    const market = toMarket(raw.mrktCtg);

    // 셋 중 하나라도 없으면 검색 인덱스로 쓸 수 없다 — 조용히 버린다.
    // 단축코드는 6자리 숫자만 유효하다(우선주·신주인수권도 이 형상을 지킨다).
    if (!shortCode || !koreanName || !market) return [];
    if (!/^\d{6}$/.test(shortCode)) return [];

    return [
        {
            shortCode,
            koreanName,
            market,
            isin: raw.isinCd?.trim() ?? '',
            corpName: raw.corpNm?.trim() ?? koreanName,
        },
    ];
}

/** `items`가 `{ item: [] }` 래퍼로 오기도 하고 배열로 바로 오기도 한다. */
function unwrapItems(
    items: { item?: RawItem[] } | RawItem[] | undefined
): RawItem[] {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    return items.item ?? [];
}

async function fetchPage(
    key: string,
    pageNo: number,
    basDt: string | undefined
): Promise<{ items: KrxListedItem[]; totalCount: number }> {
    const params = new URLSearchParams({
        serviceKey: key,
        resultType: 'json',
        numOfRows: String(MAX_ROWS_PER_PAGE),
        pageNo: String(pageNo),
        ...(basDt ? { basDt } : {}),
    });

    const res = await fetch(`${ENDPOINT}?${params}`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`[krxListedInfo] HTTP ${res.status}`);
    }

    const body = (await res.json()) as RawResponse;
    const code = body.response?.header?.resultCode;
    if (code !== undefined && code !== RESULT_CODE_OK) {
        throw new Error(
            `[krxListedInfo] resultCode=${code} ${body.response?.header?.resultMsg ?? ''}`
        );
    }

    return {
        items: unwrapItems(body.response?.body?.items).flatMap(toItem),
        totalCount: body.response?.body?.totalCount ?? 0,
    };
}

/**
 * 상장 종목 전체를 페이지네이션으로 수집한다.
 *
 * `basDt`(기준일자, `YYYYMMDD`)를 생략하면 API가 최신 기준일을 쓴다. 주말·공휴일에
 * 호출하면 직전 영업일 데이터가 돌아온다.
 *
 * 자격증명이 없으면 **빈 배열**을 돌려준다 — 시드는 선택 기능이고, 키가 없다고
 * 앱이 죽어서는 안 된다(뉴스 provider와 같은 degrade 규약).
 *
 * @throws 네트워크·API 오류. 시드 스크립트가 실패를 인지해야 하므로 여기서는 삼키지 않는다.
 */
export async function fetchKrxListedItems(
    basDt?: string
): Promise<KrxListedItem[]> {
    const key = serviceKey();
    if (!key) {
        console.warn(
            '[krxListedInfo] DATA_GO_KR_SERVICE_KEY 미설정 — 빈 목록 반환'
        );
        return [];
    }

    const collected: KrxListedItem[] = [];
    let pageNo = 1;

    for (; pageNo <= MAX_PAGES; pageNo++) {
        const { items, totalCount } = await fetchPage(key, pageNo, basDt);
        collected.push(...items);

        // 마지막 페이지 판정: 누적이 총계에 도달했거나 이번 페이지가 비었을 때.
        // totalCount를 못 받은 경우(0)에도 빈 페이지에서 멈춘다.
        if (items.length === 0) break;
        if (totalCount > 0 && collected.length >= totalCount) break;
    }

    if (pageNo > MAX_PAGES) {
        console.warn(
            `[krxListedInfo] MAX_PAGES(${MAX_PAGES}) 도달 — 결과가 잘렸을 수 있다`
        );
    }

    return collected;
}
