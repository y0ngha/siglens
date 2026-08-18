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

/** 네이버 검색 API의 `display` 상한. 이보다 큰 값을 보내면 400이 돌아온다. */
export const NAVER_MAX_DISPLAY = 100;

/**
 * 요청 1건당 타임아웃. 레포 공통 규약(`shared/api/fmp/httpClient` 10초,
 * `shared/api/yahoo/createYahooClient` 8초)을 따른다 — bare `fetch`는 undici 기본
 * 300초라, 소켓 하나가 멈추면 prewarm 유닛 예산(120초)을 통째로 넘긴다.
 */
const NAVER_FETCH_TIMEOUT_MS = 8_000;

/** 네이버 검색 결과의 단일 기사(원본 형태). */
export interface NaverNewsItem {
    title?: string;
    originallink?: string;
    link?: string;
    description?: string;
    pubDate?: string;
}

interface NaverNewsResponse {
    items?: NaverNewsItem[];
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

function credentials(): { id: string; secret: string } | null {
    const id = process.env.NAVER_CLIENT_ID;
    const secret = process.env.NAVER_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
}

/**
 * 네이버 뉴스 검색 1회. 실패(자격증명 없음·네트워크·non-OK)는 전부 `[]`로 degrade한다 —
 * 뉴스는 부가 정보라 예외를 위로 던지면 페이지 전체가 같이 죽는다.
 *
 * @param query - 검색어(한국어). 종목명 또는 시장 키워드.
 * @param display - 요청 건수. {@link NAVER_MAX_DISPLAY}로 clamp된다.
 * @param logTag - 로그 접두사. 어느 소비자가 실패했는지 구분하기 위해 주입받는다.
 */
export async function searchNaverNews(
    query: string,
    display: number,
    logTag: string
): Promise<NaverNewsItem[]> {
    const creds = credentials();
    if (!creds) return [];

    const url = `${NAVER_NEWS_ENDPOINT}?${new URLSearchParams({
        query,
        display: String(Math.min(display, NAVER_MAX_DISPLAY)),
        // 'sim' = 정확도순. **최신순('date')을 쓰면 안 된다.**
        //
        // 네이버 뉴스 검색은 본문까지 대상으로 하므로, 종목명이 스쳐 지나가듯
        // 한 번 언급된 정치·연예 기사도 결과에 들어온다. 최신순은 그런 기사를
        // 관련성과 무관하게 상위에 올린다.
        //
        // 실측(2026-08-17, 40건 기준 제목에 종목명이 포함된 비율):
        //   sort=date → 삼성전자 18% / 카카오 15% / 에코프로비엠 18% / 현대차 23%
        //   sort=sim  → 삼성전자 90% / 카카오 98% / 에코프로비엠 95% / 현대차 98%
        //
        // 처음에는 "정확도순은 오래된 기사가 올라와 cutoff를 통과하는 수가 준다"는
        // 이유로 최신순을 골랐는데, 실측해 보니 정반대였다 — 정확도순도 최근
        // 기사로 채워지고 관련성만 크게 높아진다.
        sort: 'sim',
    })}`;

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                // API HUB는 NCP API Gateway 규약을 쓴다 — 구 개발자센터의
                // `X-Naver-Client-*` 헤더로는 401이 떨어진다(모듈 주석 참조).
                'X-NCP-APIGW-API-KEY-ID': creds.id,
                'X-NCP-APIGW-API-KEY': creds.secret,
            },
            // 뉴스는 신선도가 핵심이라 상위 계층(news 테이블 + ISR 태그)이 캐싱을 맡는다.
            cache: 'no-store',
            signal: AbortSignal.timeout(NAVER_FETCH_TIMEOUT_MS),
        });
    } catch (e) {
        console.warn(`${logTag} fetch failed`, query, e);
        return [];
    }

    if (!response.ok) {
        console.warn(`${logTag} non-OK response`, query, response.status);
        return [];
    }

    const body = (await response.json()) as NaverNewsResponse;
    return body.items ?? [];
}
