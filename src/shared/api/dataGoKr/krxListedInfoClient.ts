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
 *
 * **`server-only`를 선언하지 않는다.** 이 모듈의 주 소비자는 Next 런타임 밖에서 `tsx`로
 * 도는 시드 스크립트(`scripts/seed-kr-listed-names.ts`)다. `server-only`는 번들러가
 * 제공하는 가상 패키지라 `node_modules`에 실체가 없어, 선언하면 시드가
 * `MODULE_NOT_FOUND`로 즉시 죽는다. 대신 이 파일은 `fetch`와 순수 매핑만 쓰고
 * DB·비밀키 접근이 없어 클라이언트 번들에 섞여도 위험이 없다 — API 키는
 * 호출 시점에 `process.env`에서 읽으므로 클라이언트에서는 자연히 비어 빈 배열로 끝난다.
 */

const ENDPOINT =
    'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo';

/** API가 허용하는 페이지당 최대 행 수. */
const MAX_ROWS_PER_PAGE = 1000;

/** 폭주 방지 상한 — KOSPI+KOSDAQ+KONEX 전체가 3,000 종목 남짓이라 넉넉하다. */
const MAX_PAGES = 20;

/**
 * 페이지 1건당 타임아웃. 레포 공통 규약(`shared/api/fmp/httpClient` 10초,
 * `shared/api/yahoo/createYahooClient` 8초)을 따른다 — bare `fetch`는 undici 기본
 * 300초라 멈춘 소켓 하나가 아래 전체 예산을 혼자 다 먹는다.
 */
const PAGE_TIMEOUT_MS = 10_000;

/**
 * 수집 전체의 wall-clock 예산.
 *
 * 페이지 타임아웃만으로는 부족하다 — 후보 하나가 `MAX_PAGES`를 다 쓰면 20 × 10초
 * = 200초로, 배포 드레인 창(180초)을 넘긴다. 이 수집은 크론 라우트의 `after()`
 * 안에서 돌고 그 promise가 SIGTERM 드레인에 등록되므로
 * (`app/api/cron/kr-tickers/route.ts`) 그만큼 종료를 붙잡는다.
 *
 * 후보 루프에서만 재면 도달할 수 없다: `collectAllPages`는 첫 페이지가 비었을
 * 때만 `[]`를 돌려주고, 한 건이라도 있으면 호출부가 즉시 반환하므로 후보를
 * 넘기는 경로는 후보당 정확히 1페이지다(≤ 10 × 10초). 그래서 **페이지 단위로**
 * 잰다.
 *
 * 예산에 걸려 잘린 목록이 상폐 판정을 오염시키지는 않는다 — `planKrTickerReconcile`의
 * 대량 상폐 가드가 그런 목록에서 걸려 상폐만 건너뛴다. 정상 경로는 첫 후보
 * 3~4페이지로 끝나 수 초다.
 */
const TOTAL_BUDGET_MS = 120_000;

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

/**
 * 인증키를 Decoding 형태로 정규화한다.
 *
 * 공공데이터포털은 같은 키를 Encoding·Decoding 두 형태로 함께 발급한다. Encoding 키는
 * 이미 percent-encoding이 적용된 문자열(`…%2B…%3D`)인데, 이 클라이언트는
 * `URLSearchParams`로 쿼리를 만들면서 값을 한 번 더 인코딩한다. 그대로 두면 `%`가
 * `%25`로 이중 인코딩되어 서버가 다른 키로 인식한다.
 *
 * **실측(2026-08-17)**: 같은 키를 Decoding 형태로 보내면 `200 OK`(총 4,166,892건),
 * Encoding 형태 그대로 보내면 `403`이었다.
 *
 * "Decoding 키를 넣으세요"라고 문서로만 요구하지 않고 코드가 흡수하는 이유: 포털 화면이
 * 두 키를 나란히 보여 주고 이름도 비슷해 잘못 고르기 쉽다. 실제로 이 프로젝트에서도
 * 처음 전달된 키가 Encoding 형태였다. 사람이 매번 옳게 고르길 기대하는 대신,
 * 양쪽 다 받아 주는 편이 안전하다.
 *
 * `decodeURIComponent`는 이미 디코딩된 문자열에 대해 멱등이다 — Decoding 키에는
 * `%`가 없으므로 그대로 통과한다. 다만 키에 `%`가 들어 있는데 유효한 이스케이프가
 * 아니면 `URIError`를 던지므로, 그 경우 원본을 그대로 쓴다.
 */
function normalizeServiceKey(key: string): string {
    try {
        return decodeURIComponent(key);
    } catch {
        return key;
    }
}

function serviceKey(): string | null {
    const raw = process.env.DATA_GO_KR_SERVICE_KEY;
    return raw ? normalizeServiceKey(raw) : null;
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

/**
 * 단축코드에서 앞의 `A` 접두사를 떼어 6자리 종목코드만 남긴다.
 *
 * 실측(2026-08-17): 이 API의 `srtnCd`는 `A900110` 형태로 온다 — KRX 내부 표기라
 * 앞에 종목 구분 문자가 붙는다. 우리 canonical 심볼(`005930.KS`)은 순수 6자리를
 * 쓰므로 여기서 정규화해야 한다. 접두사를 그대로 두면 형상 검사에서 전부 탈락해
 * **시드 결과가 조용히 0건이 된다**(실제로 그렇게 실패했다).
 *
 * 접두사가 없는 형태로 바뀌어도 동작하도록 있을 때만 떼어낸다.
 */
function toShortCode(raw: string | undefined): string | null {
    const trimmed = raw?.trim().toUpperCase();
    if (!trimmed) return null;
    const digits = trimmed.startsWith('A') ? trimmed.slice(1) : trimmed;
    return /^\d{6}$/.test(digits) ? digits : null;
}

function toItem(raw: RawItem): KrxListedItem[] {
    const shortCode = toShortCode(raw.srtnCd);
    const koreanName = raw.itmsNm?.trim();
    const market = toMarket(raw.mrktCtg);

    // 셋 중 하나라도 없으면 검색 인덱스로 쓸 수 없다 — 조용히 버린다.
    if (!shortCode || !koreanName || !market) return [];

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

    const res = await fetch(`${ENDPOINT}?${params}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
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
 * 최근 영업일 후보를 오늘부터 거슬러 올라가며 만든다.
 *
 * `basDt`를 생략하면 API가 **전 기간 누적**(실측 totalCount 4,166,892건)을 돌려주므로
 * 반드시 하루를 지정해야 한다. 다만 어느 날짜에 데이터가 있는지는 미리 알 수 없다 —
 * 주말·공휴일은 비고, 갱신도 "기준일 다음 영업일 13시 이후"라 오늘 날짜는 대개 이르다.
 * 그래서 하루씩 뒤로 물러나며 첫 번째로 결과가 있는 날을 쓴다.
 */
function recentDateCandidates(days: number): string[] {
    const out: string[] = [];
    for (let i = 1; i <= days; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        out.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
    }
    return out;
}

/** 데이터가 있는 기준일을 찾기 위해 거슬러 올라갈 최대 일수(연휴를 넉넉히 커버). */
const MAX_DATE_LOOKBACK_DAYS = 10;

/**
 * 상장 종목 전체를 페이지네이션으로 수집한다.
 *
 * `basDt`(기준일자, `YYYYMMDD`)를 명시하면 그 날짜만 조회한다. 생략하면 최근 영업일을
 * 자동으로 찾는다 — API는 기준일을 지정하지 않으면 전 기간 누적을 돌려주기 때문에
 * 생략을 "최신"으로 해석하면 안 된다.
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

    const candidates = basDt
        ? [basDt]
        : recentDateCandidates(MAX_DATE_LOOKBACK_DAYS);

    const deadline = Date.now() + TOTAL_BUDGET_MS;

    for (const date of candidates) {
        const items = await collectAllPages(key, date, deadline);
        if (items.length > 0) return items;
        // 주말·공휴일이거나 아직 갱신 전이다 — 하루 더 거슬러 올라간다.
        if (Date.now() >= deadline) {
            console.warn(
                `[krxListedInfo] 예산(${TOTAL_BUDGET_MS}ms) 소진 — ${date}까지 확인하고 중단`
            );
            return [];
        }
    }

    console.warn(
        `[krxListedInfo] 최근 ${MAX_DATE_LOOKBACK_DAYS}일 안에서 데이터를 찾지 못했다`
    );
    return [];
}

/** 한 기준일의 전 페이지를 모은다. */
async function collectAllPages(
    key: string,
    basDt: string,
    deadline: number
): Promise<KrxListedItem[]> {
    const collected: KrxListedItem[] = [];
    let pageNo = 1;

    for (; pageNo <= MAX_PAGES; pageNo++) {
        if (Date.now() >= deadline) {
            console.warn(
                `[krxListedInfo] 예산(${TOTAL_BUDGET_MS}ms) 소진 — ${basDt} ${pageNo}페이지에서 중단, 결과가 잘렸을 수 있다`
            );
            break;
        }
        const { items, totalCount } = await fetchPage(key, pageNo, basDt);
        collected.push(...items);

        // 마지막 페이지 판정: 이번 페이지가 비었거나 총계에 도달했을 때.
        // `totalCount`는 형상 검사로 걸러지기 전의 원본 건수라 `collected.length`가
        // 그보다 작을 수 있다 — 빈 페이지 조건이 실질적인 종료 신호다.
        if (items.length === 0) break;
        if (totalCount > 0 && pageNo * MAX_ROWS_PER_PAGE >= totalCount) break;
    }

    if (pageNo > MAX_PAGES) {
        console.warn(
            `[krxListedInfo] MAX_PAGES(${MAX_PAGES}) 도달 — 결과가 잘렸을 수 있다`
        );
    }

    return collected;
}
