/**
 * NAVER API HUB 뉴스 검색의 저수준 클라이언트 — 엔드포인트·인증·HTML 정리·날짜 파싱.
 *
 * 두 소비자가 있다.
 * - `naverNewsClient.ts` — 종목 단위(`005930.KS` → "삼성전자")
 * - `entities/market-news/lib/naverMarketNewsClient.ts` — 시장 단위("코스피")
 *
 * 둘이 엔드포인트·헤더·마크업 정리를 각자 갖고 있으면, 네이버가 또 한 번 이관할 때
 * (아래 2026-07 사례) 한쪽만 고쳐지고 다른 쪽은 401을 조용히 삼킨다.
 *
 * 구 개발자센터(`openapi.naver.com/v1/search/news.json`)는 2026-07-31부로 **신규 신청이
 * 마감**됐고 검색 API가 네이버 클라우드의 API HUB로 이관됐다(레거시 인증 지원은
 * 2027-06-30 종료). 도메인·경로·헤더가 모두 바뀌어 도메인만 갈아끼우는 것으로는 안 된다.
 *
 * **실측(2026-08-17)**: 새로 발급한 키로 구 엔드포인트를 호출하면
 * `401 NID AUTH Result Invalid`, HUB 엔드포인트는 `200 OK`(총 4,427,608건).
 */
const NAVER_NEWS_ENDPOINT =
    'https://naverapihub.apigw.ntruss.com/search/v1/news';
/** 웹문서 검색(NCP API HUB). 에이전트 `web_search` 전용 애플리케이션 키로 호출한다. */
const NAVER_WEB_ENDPOINT =
    'https://naverapihub.apigw.ntruss.com/search/v1/webkr';

/** 네이버 검색 API의 `display` 상한. 이보다 큰 값을 보내면 400이 돌아온다. */
export const NAVER_MAX_DISPLAY = 100;

/**
 * 요청 1건당 타임아웃. 레포 공통 규약(`shared/api/fmp/httpClient` 10초,
 * `shared/api/yahoo/createYahooClient` 8초)을 따른다 — bare `fetch`는 undici 기본
 * 300초라, 소켓 하나가 멈추면 prewarm 유닛 예산(120초)을 통째로 넘긴다.
 */
const NAVER_FETCH_TIMEOUT_MS = 8_000;

/** 네이버 검색 정렬. `sim` = 정확도순, `date` = 최신순. */
export type NaverSearchSort = 'sim' | 'date';

/** 네이버 검색 결과의 단일 기사(원본 형태). */
export interface NaverNewsItem {
    title?: string;
    originallink?: string;
    link?: string;
    description?: string;
    pubDate?: string;
}

/** 웹문서 검색 결과의 단일 문서(원본 형태). 날짜 필드가 없다. */
export interface NaverWebItem {
    title?: string;
    link?: string;
    description?: string;
}

type NaverRequestOutcome<T> =
    | { ok: true; items: T[] }
    | {
          ok: false;
          kind: 'fetch_failed' | 'non_ok' | 'malformed';
          status?: number;
      };

/** 두 엔드포인트가 공유하는 요청 본체 — 인증·타임아웃·JSON 파싱. 로그는 호출부가 맡는다. */
async function requestNaver<T>(
    endpoint: string,
    params: Record<string, string>,
    creds: NaverCredentials,
    signal?: AbortSignal
): Promise<NaverRequestOutcome<T>> {
    const url = `${endpoint}?${new URLSearchParams(params)}`;
    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                // API HUB는 NCP API Gateway 규약을 쓴다 — 구 개발자센터의
                // `X-Naver-Client-*` 헤더로는 401이 떨어진다(모듈 주석 참조).
                'X-NCP-APIGW-API-KEY-ID': creds.id,
                'X-NCP-APIGW-API-KEY': creds.secret,
            },
            // 신선도가 핵심이라 상위 계층(news 테이블 + ISR 태그)이 캐싱을 맡는다.
            cache: 'no-store',
            signal: signal
                ? AbortSignal.any([
                      signal,
                      AbortSignal.timeout(NAVER_FETCH_TIMEOUT_MS),
                  ])
                : AbortSignal.timeout(NAVER_FETCH_TIMEOUT_MS),
        });
    } catch {
        return { ok: false, kind: 'fetch_failed' };
    }
    if (!response.ok)
        return { ok: false, kind: 'non_ok', status: response.status };
    // A 200 does not guarantee a JSON body (gateway interstitial, outage page).
    try {
        const body = (await response.json()) as { items?: T[] };
        return { ok: true, items: body.items ?? [] };
    } catch {
        return { ok: false, kind: 'malformed' };
    }
}

const HTML_TAG_RE = /<[^>]*>/g;
const NAMED_ENTITIES: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    // `&amp;`는 마지막에 풀어야 `&amp;lt;` 같은 이중 인코딩이 태그로 되살아나지 않는다.
    '&amp;': '&',
};

/**
 * 네이버는 검색어와 일치하는 구간을 `<b>` 태그로 감싸고 본문을 HTML 엔티티로 인코딩해
 * 보낸다. 그대로 저장하면 제목에 마크업이 섞이고, AI 분석 입력에도 태그가 들어간다.
 */
export function stripNaverMarkup(raw: string): string {
    let text = raw.replace(HTML_TAG_RE, '');
    for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
        text = text.split(entity).join(char);
    }
    return text.trim();
}

/**
 * 네이버 `pubDate`는 RFC 1123(`Mon, 26 Sep 2016 07:50:00 +0900`) 형식이다.
 * `Date`가 그대로 파싱하며 오프셋이 들어 있어 UTC 변환이 정확하다 —
 * FMP처럼 타임존 없는 문자열을 보정할 필요가 없다.
 */
export function toIsoPublishedAt(pubDate: string | undefined): string | null {
    if (!pubDate) return null;
    const parsed = new Date(pubDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 자격증명이 모두 설정돼 있는지. 없으면 호출부는 빈 결과로 degrade한다. */
export function hasNaverCredentials(): boolean {
    return Boolean(
        process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
    );
}

/** NCP API HUB 애플리케이션 자격증명 한 쌍. */
export interface NaverCredentials {
    readonly id: string;
    readonly secret: string;
}

function credentials(): NaverCredentials | null {
    const id = process.env.NAVER_CLIENT_ID;
    const secret = process.env.NAVER_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
}

/**
 * SiglensAI `web_search` 전용 애플리케이션(`NAVER_AI_CLIENT_*`). 뉴스 수집용
 * `NAVER_CLIENT_*`와 **일부러 분리**한다 — 에이전트 검색량이 `/news/kr` 수집의
 * 일일 쿼터를 깎아 먹거나, 한쪽 키 회수가 다른 쪽을 같이 죽이면 안 된다.
 */
export function naverAiCredentials(): NaverCredentials | null {
    const id = process.env.NAVER_AI_CLIENT_ID;
    const secret = process.env.NAVER_AI_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
}

/**
 * 네이버 뉴스 검색 1회. 실패(자격증명 없음·네트워크·non-OK)는 전부 `[]`로 degrade한다 —
 * 뉴스는 부가 정보라 예외를 위로 던지면 페이지 전체가 같이 죽는다.
 *
 * @param query - 검색어(한국어). 종목명 또는 시장 키워드.
 * @param display - 요청 건수. {@link NAVER_MAX_DISPLAY}로 clamp된다.
 * @param logTag - 로그 접두사. 어느 소비자가 실패했는지 구분하기 위해 주입받는다.
 * @param sort - 정렬. 기본 `'sim'`(정확도순) — 아래 URL 주석의 실측 근거 참조.
 *   `'date'`는 **최신 보장이 필요한 보조 질의**에만 쓴다.
 */
export async function searchNaverNews(
    query: string,
    display: number,
    logTag: string,
    sort: NaverSearchSort = 'sim',
    /** Caller's cancel signal (an agent turn's); combined with the own 8s timeout. */
    signal?: AbortSignal,
    /** 다른 애플리케이션 키로 부를 때(에이전트). 기본은 뉴스 수집용 `NAVER_CLIENT_*`. */
    credsOverride?: NaverCredentials
): Promise<NaverNewsItem[]> {
    const creds = credsOverride ?? credentials();
    if (!creds) {
        // **조용히 끝내지 않는다.** 키가 없거나 SSM 로테이션이 컨테이너에 닿지
        // 않으면 `/news/kr`이 200 + "불러오지 못했어요" + noindex로 굳는데,
        // 로그가 한 줄도 없으면 CloudWatch에 아무 흔적이 남지 않는다.
        console.error(
            `${logTag} NAVER_CLIENT_ID/SECRET 미설정 — 빈 결과로 degrade`,
            query
        );
        return [];
    }

    const outcome = await requestNaver<NaverNewsItem>(
        NAVER_NEWS_ENDPOINT,
        {
            query,
            display: String(Math.min(display, NAVER_MAX_DISPLAY)),
            // 기본값 'sim' = 정확도순. **주 질의를 최신순('date')으로 돌리면 안 된다.**
            //
            // 네이버 뉴스 검색은 본문까지 대상으로 하므로, 종목명이 스쳐 지나가듯
            // 한 번 언급된 정치·연예 기사도 결과에 들어온다. 최신순은 그런 기사를
            // 관련성과 무관하게 상위에 올린다.
            //
            // 실측(2026-08-17, 40건 기준 제목에 종목명이 포함된 비율):
            //   sort=date → 삼성전자 18% / 카카오 15% / 에코프로비엠 18% / 현대차 23%
            //   sort=sim  → 삼성전자 90% / 카카오 98% / 에코프로비엠 95% / 현대차 98%
            //
            // 정확도순은 **최신을 보장하지는 않는다.** 조용한 한 주에는 상위 결과가
            // 전부 lookback 창 밖으로 밀려 피드가 통째로 빌 수 있다. 그 바닥은
            // 소비자가 `'date'` 보조 질의 하나를 섞어 받친다(`naverMarketNewsClient`).
            sort,
        },
        creds,
        signal
    );
    if (outcome.ok) return outcome.items;
    if (outcome.kind === 'fetch_failed') {
        console.warn(`${logTag} fetch failed`, query);
        return [];
    }
    if (outcome.kind === 'non_ok') {
        // **warn이 아니라 error다.** 키 회수·NCP 구독 만료·일일 쿼터 소진이 전부
        // 여기로 떨어지는데, `/news/kr`은 소스가 이것 하나뿐이라 빈 결과가 곧
        // 200 + "불러오지 못했어요" + noindex로 굳는다. 부분 신호조차 없다.
        // CloudWatch 알람이 `"non-OK response"`(ASCII) 접두를 센다.
        console.error(`${logTag} non-OK response`, query, outcome.status);
        return [];
    }
    console.warn(`${logTag} malformed JSON body`, query);
    return [];
}

/**
 * 네이버 웹문서 검색 1회 — 정부·기관·기업 페이지처럼 뉴스가 아닌 한국어 웹을 위한
 * 보조 경로(에이전트 `web_search`). 뉴스와 같은 계약(절대 throw하지 않음). 로그는
 * `/news/kr` 알람 필터(`non-OK response`)와 겹치지 않는 문구를 쓴다 — 이 경로의
 * 장애는 뉴스 수집 장애가 아니다.
 *
 * @param query - 검색어(한국어).
 * @param display - 요청 건수. {@link NAVER_MAX_DISPLAY}로 clamp된다.
 * @param logTag - 로그 접두사.
 * @param creds - 호출에 쓸 애플리케이션 키(에이전트는 {@link naverAiCredentials}).
 * @param signal - 호출자 취소 신호(에이전트 턴). 자체 8초 타임아웃과 결합.
 * @returns 문서 목록. 실패면 `[]`.
 */
export async function searchNaverWeb(
    query: string,
    display: number,
    logTag: string,
    creds: NaverCredentials,
    signal?: AbortSignal
): Promise<NaverWebItem[]> {
    const outcome = await requestNaver<NaverWebItem>(
        NAVER_WEB_ENDPOINT,
        { query, display: String(Math.min(display, NAVER_MAX_DISPLAY)) },
        creds,
        signal
    );
    if (outcome.ok) return outcome.items;
    if (outcome.kind === 'non_ok')
        console.warn(`${logTag} webkr request rejected`, outcome.status);
    else console.warn(`${logTag} webkr ${outcome.kind}`, query);
    return [];
}
