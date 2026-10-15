import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { KR_SHORT_CODE_RE } from '@/shared/config/ticker';
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

const LISTED_INFO_ENDPOINT =
    'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo';

/**
 * 금융위원회_주식시세정보 V2(공공데이터포털 활용신청 필요 — 운영 키는 2026-10-15 승인).
 *
 * **경로에 `/service/`가 없고 서비스·기능명 끝에 `_V2`가 붙는다** — 옛 경로
 * (`/service/GetStockSecuritiesInfoService/getStockPriceInfo`)는 이 키로 403이다
 * (2026-10-15 실측). 우선주를 포함한 상장 주식 전체가 오므로, 보통주만 주는 마스터의
 * **보충**으로 쓴다. 응답 필드(`srtnCd`·`itmsNm`·`mrktCtg`·`isinCd`)가 마스터와 같아
 * 같은 파서를 쓰고, 시세 필드(`clpr` 등)는 읽지 않는다. `srtnCd`에 `A` 접두사가 없다.
 */
const STOCK_PRICE_ENDPOINT =
    'https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2';

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
 * **드레인이 기다리는 건 fetch가 끝나는 시점이 아니다.** `syncKrListedTickers`는
 * 그 뒤에 `findAllListingStatuses` + `upsertMany`(약 2,595행 / 500 = 6 왕복,
 * 각각 Neon 일시 오류 재시도 예산 포함) + relist/delist + 캐시 무효화를 더 돌고,
 * 그 전체가 끝나야 promise가 resolve한다. 그러니 실제 제약은
 * `TOTAL_BUDGET_MS + 최악 DB 단계 <= SHUTDOWN_DRAIN_DEADLINE_MS(180초)`다 —
 * 넘치면 드레인이 먼저 끝나고 동기화가 잘리는데, EventBridge는 이미 202를 받았고
 * `sync done`/`sync failed` 어느 쪽도 안 찍혀 **아무 알람도 안 뜬다**. 마스터 70초 +
 * 보충({@link SUPPLEMENT_BUDGET_MS}) 20초 = 90초로 잡아 DB 단계에 90초를 남긴다.
 *
 * 후보 루프에서만 재면 도달할 수 없다: `collectAllPages`는 첫 페이지가 비었을
 * 때만 `[]`를 돌려주고, 한 건이라도 있으면 호출부가 즉시 반환하므로 후보를
 * 넘기는 경로는 후보당 정확히 1페이지다(≤ 10 × 10초). 그래서 **페이지 단위로**
 * 잰다.
 *
 * 예산이 닳는 지점에 따라 결과가 갈린다.
 *  - **페이지 도중**: 남은 예산으로 자른 `AbortSignal`이 그 fetch를 끊고,
 *    `collectAllPages`에 catch가 없어 `TimeoutError`가 크론 라우트까지 올라가
 *    `[kr-tickers] sync failed`로 알람이 뜬다. 멱등한 일 1회 작업이라 다음 날
 *    재시도로 회복된다.
 *  - **페이지 경계**: `MIN_PAGE_BUDGET_MS` 하한에 걸려 다음 페이지를 시작하지 않고
 *    모은 만큼 돌려준다. 잘린 목록이지만 `planKrTickerReconcile`의 대량 상폐 가드가
 *    받아 상폐만 건너뛴다(포털이 일부 페이지만 주는 경우와 같은 처리다).
 *
 * 정상 경로는 첫 후보 3~4페이지로 끝나 수 초다.
 */
const TOTAL_BUDGET_MS = 70_000;

/**
 * 남은 예산이 이보다 적으면 페이지를 아예 시작하지 않는다.
 *
 * 클램프만 두면 `remaining`이 수십 ms일 때 곧 도착했을 응답까지 끊고, 그 abort가
 * `TimeoutError`로 올라가 **이미 모은 페이지를 통째로 버린다**. 그 밑에서 취할 수
 * 있는 건 아무것도 없으므로, 그럴 바엔 모은 만큼 들고 문서화된 truncation 경로로
 * 빠지는 편이 낫다 — 대량 상폐 가드가 그 목록을 받아 상폐만 건너뛴다.
 * 1초는 실측 페이지 응답(수백 ms)보다 넉넉하고, 예산 70초에 비해 무시할 만하다.
 */
const MIN_PAGE_BUDGET_MS = 1_000;

/**
 * 보충(주식시세 V2) 수집 예산. 한 기준일 약 2,900행 = 3페이지라 정상은 수 초다.
 * 마스터 예산과 합쳐 90초를 넘지 않게 잡는다(위 {@link TOTAL_BUDGET_MS} 참조).
 */
const SUPPLEMENT_BUDGET_MS = 20_000;

/** 시장 구분 값. `mrktCtg` 필드가 이 셋 중 하나로 온다. */
type KrxMarket = 'KOSPI' | 'KOSDAQ' | 'KONEX';

export interface KrxListedItem {
    /** 단축코드(예: `005930`, `0001A0`). 거래소 접미사는 붙어 있지 않다. */
    shortCode: string;
    /** 한글 종목명(예: `삼성전자`). */
    koreanName: string;
    /** 시장 구분. */
    market: KrxMarket;
    /** ISIN 12자리. */
    isin: string;
    /** 법인명(한글). 종목명과 다를 수 있다(우선주·ETF 등). 보충 소스는 없어 종목명을 쓴다. */
    corpName: string;
    /** 이 항목을 받은 기준일(`YYYYMMDD`). 마스터와 보충을 같은 날로 맞추는 데 쓴다. */
    basDt: string;
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
 * 단축코드에서 앞의 `A` 접두사를 떼어 종목코드만 남긴다.
 *
 * 실측(2026-08-17): 이 API의 `srtnCd`는 `A900110` 형태로 온다 — KRX 내부 표기라
 * 앞에 종목 구분 문자가 붙는다. 우리 canonical 심볼(`005930.KS`)은 단축코드만
 * 쓰므로 여기서 정규화해야 한다. 접두사를 그대로 두면 형상 검사에서 전부 탈락해
 * **시드 결과가 조용히 0건이 된다**(실제로 그렇게 실패했다).
 *
 * 접두사가 없는 형태로 바뀌어도 동작하도록 있을 때만 떼어낸다(주식시세 V2는 접두사가 없다).
 * 단축코드는 숫자로 시작하므로(`KR_SHORT_CODE_PATTERN`) 첫 `A`를 떼도 코드가 상하지 않는다.
 * 형상은 숫자 6자리가 아니다 — 영문이 섞인 코드(`0001A0`)를 여기서 버려 64종목이
 * 통째로 누락됐었다(2026-10-15).
 */
function toShortCode(raw: string | undefined): string | null {
    const trimmed = raw?.trim().toUpperCase();
    if (!trimmed) return null;
    const code = trimmed.startsWith('A') ? trimmed.slice(1) : trimmed;
    return KR_SHORT_CODE_RE.test(code) ? code : null;
}

function toItem(raw: RawItem, basDt: string): KrxListedItem[] {
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
            basDt,
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

/** 어느 API를 부르는지 — 엔드포인트와 로그 태그. */
interface DataGoKrSource {
    endpoint: string;
    tag: string;
    budgetMs: number;
}

const LISTED_INFO_SOURCE: DataGoKrSource = {
    endpoint: LISTED_INFO_ENDPOINT,
    tag: '[krxListedInfo]',
    budgetMs: TOTAL_BUDGET_MS,
};

const STOCK_PRICE_SOURCE: DataGoKrSource = {
    endpoint: STOCK_PRICE_ENDPOINT,
    tag: '[stockPriceInfo]',
    budgetMs: SUPPLEMENT_BUDGET_MS,
};

async function fetchPage(
    source: DataGoKrSource,
    key: string,
    pageNo: number,
    basDt: string,
    timeoutMs: number = PAGE_TIMEOUT_MS
): Promise<{ items: KrxListedItem[]; rawCount: number; totalCount: number }> {
    const params = new URLSearchParams({
        serviceKey: key,
        resultType: 'json',
        numOfRows: String(MAX_ROWS_PER_PAGE),
        pageNo: String(pageNo),
        basDt,
    });

    const res = await fetch(`${source.endpoint}?${params}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
        throw new Error(`${source.tag} HTTP ${res.status}`);
    }

    const body = (await res.json()) as RawResponse;
    const code = body.response?.header?.resultCode;
    if (code !== undefined && code !== RESULT_CODE_OK) {
        throw new Error(
            `${source.tag} resultCode=${code} ${body.response?.header?.resultMsg ?? ''}`
        );
    }

    const rawItems = unwrapItems(body.response?.body?.items);
    return {
        items: rawItems.flatMap(raw => toItem(raw, basDt)),
        // 형상 필터 전 원본 행 수 — `totalCount`(역시 원본 기준)와 비교해 잘림을 판정한다.
        rawCount: rawItems.length,
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
        out.push(toUtcIsoDate(d).replace(/-/g, ''));
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
        const { items } = await collectAllPages(
            LISTED_INFO_SOURCE,
            key,
            date,
            deadline
        );
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

/**
 * 주식시세 V2에서 한 기준일의 상장 주식 목록을 받는다 — 마스터에 없는 우선주를 보충하기 위해서다.
 *
 * `basDt`는 필수다. 마스터가 실제로 데이터를 찾은 날짜({@link KrxListedItem.basDt})를 넘겨야
 * 두 목록의 합집합이 같은 날을 가리킨다. 키가 없으면 빈 목록, 네트워크·API 오류는 던진다.
 *
 * `truncated`를 함께 돌려준다 — 마스터는 잘린 목록을 대량 상폐 가드가 받아 주지만, 보충은
 * 25개 미만이 빠지면 그 가드를 그대로 통과해 우선주가 조용히 상폐된다. 호출부는 잘린 보충을
 * "보충 불가"로 다뤄야 한다.
 */
export async function fetchStockPriceItems(
    basDt: string
): Promise<{ items: KrxListedItem[]; truncated: boolean }> {
    const key = serviceKey();
    if (!key) return { items: [], truncated: false };
    return collectAllPages(
        STOCK_PRICE_SOURCE,
        key,
        basDt,
        Date.now() + STOCK_PRICE_SOURCE.budgetMs
    );
}

/**
 * 한 기준일의 전 페이지를 모은다.
 *
 * `truncated`: 예산 하한이나 `MAX_PAGES`에 걸려 마지막 페이지 전에 멈췄거나, 빈 페이지로
 * 끝났는데 받은 원본 행 수가 API가 알린 `totalCount`보다 적다(중간 페이지가 일시적으로 비어
 * 온 경우). 원본 기준으로 세므로 형상 필터로 떨어진 행은 잘림으로 보지 않는다.
 */
async function collectAllPages(
    source: DataGoKrSource,
    key: string,
    basDt: string,
    deadline: number
): Promise<{ items: KrxListedItem[]; truncated: boolean }> {
    const collected: KrxListedItem[] = [];
    let pageNo = 1;
    let truncated = false;
    let rawCollected = 0;
    let reportedTotal = 0;

    for (; pageNo <= MAX_PAGES; pageNo++) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_PAGE_BUDGET_MS) {
            console.warn(
                `${source.tag} 예산(${source.budgetMs}ms) 소진 — ${basDt} ${pageNo}페이지에서 중단, 결과가 잘렸을 수 있다`
            );
            truncated = true;
            break;
        }
        // 남은 예산으로 잘라 준다 — 검사만으로는 예산 직전에 통과한 페이지가
        // `PAGE_TIMEOUT_MS`만큼 더 끌고 갈 수 있어 상한이 예산 + 10초가 된다.
        const { items, rawCount, totalCount } = await fetchPage(
            source,
            key,
            pageNo,
            basDt,
            Math.min(PAGE_TIMEOUT_MS, remaining)
        );
        collected.push(...items);
        rawCollected += rawCount;
        reportedTotal = Math.max(reportedTotal, totalCount);

        // 마지막 페이지 판정: 이번 페이지가 비었거나 총계에 도달했을 때.
        // `totalCount`는 형상 검사로 걸러지기 전의 원본 건수라 `collected.length`가
        // 그보다 작을 수 있다 — 빈 페이지 조건이 실질적인 종료 신호다.
        if (rawCount === 0) break;
        if (totalCount > 0 && pageNo * MAX_ROWS_PER_PAGE >= totalCount) break;
    }

    if (pageNo > MAX_PAGES) {
        console.warn(
            `${source.tag} MAX_PAGES(${MAX_PAGES}) 도달 — 결과가 잘렸을 수 있다`
        );
        truncated = true;
    }

    if (!truncated && reportedTotal > 0 && rawCollected < reportedTotal) {
        console.warn(
            `${source.tag} ${basDt} 원본 ${rawCollected}건 < totalCount ${reportedTotal} — 중간 페이지가 비어 왔다, 결과가 잘렸다`
        );
        truncated = true;
    }

    return { items: collected, truncated };
}
