import type {
    EarningsReport,
    NewsItem,
    NewsTimeRange,
} from '@y0ngha/siglens-core';
import type { NewsClientPort } from './newsClientPort';
import { computeCutoff, hashUrlToId } from './fmpNewsClient';
import { detectTruncatedBody } from './detectTruncatedBody';

/**
 * NAVER API HUB의 뉴스 검색 엔드포인트.
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
const MAX_DISPLAY = 100;

/** `NewsTimeRange`별 요청 건수. FMP 어댑터와 같은 축척이되 API 상한(100)에 맞춰 잘린다. */
const RANGE_TO_DISPLAY: Record<NewsTimeRange, number> = {
    '24h': 30,
    '7d': MAX_DISPLAY,
    '30d': MAX_DISPLAY,
};

const SOURCE_LABEL = '네이버뉴스';

/** 네이버 검색 결과의 단일 기사. */
interface NaverNewsItem {
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
function toIsoPublishedAt(pubDate: string | undefined): string | null {
    if (!pubDate) return null;
    const parsed = new Date(pubDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function credentials(): { id: string; secret: string } | null {
    const id = process.env.NAVER_CLIENT_ID;
    const secret = process.env.NAVER_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
}

/**
 * 한국 상장 종목 뉴스 클라이언트 — 네이버 검색 API.
 *
 * FMP 플랜이 KRX를 커버하지 않아 국내 종목에는 이 어댑터가 유일한 뉴스 소스다.
 *
 * **알려진 한계**: 네이버는 제목과 요약만 주고 본문은 주지 않으며, 본문 크롤링은 약관
 * 위반이다. 따라서 `bodyEn`에는 요약이 들어가고, 국내 종목의 뉴스 기반 분석은 미국
 * 종목보다 입력이 얕다. 본문이 필요해지면 빅카인즈·딥서치 같은 유료 API로 이 클래스만
 * 교체한다(`NewsClientPort` 경계가 그대로 유지된다).
 *
 * 자격증명이 없으면 빈 배열로 degrade한다 — 뉴스 탭만 비고 다른 탭은 영향받지 않는다.
 */
export class NaverNewsClient implements NewsClientPort {
    /**
     * @param resolveQuery - 심볼 → 검색어. 종목코드(`005930.KS`)로는 기사가 잡히지 않아
     * 한글 종목명이 필요하다. 이름 조회는 호출부(entities/ticker)의 책임이므로 주입받는다.
     */
    constructor(
        private readonly resolveQuery: (
            symbol: string
        ) => Promise<string | null>
    ) {}

    async fetchNews(symbol: string, range: NewsTimeRange): Promise<NewsItem[]> {
        return this.search(
            symbol,
            RANGE_TO_DISPLAY[range],
            computeCutoff(range)
        );
    }

    async fetchNewsForPeriod(
        symbol: string,
        lookbackMs: number
    ): Promise<NewsItem[]> {
        return this.search(
            symbol,
            MAX_DISPLAY,
            new Date(Date.now() - lookbackMs)
        );
    }

    /**
     * 국내 실적 발표 일정은 네이버 검색 API에 없다. 캘린더 데이터를 추정으로 채우면
     * 잘못된 발표일이 화면에 박히므로 명시적으로 제공하지 않는다.
     */
    async fetchEarningsReport(): Promise<EarningsReport | null> {
        return null;
    }

    private async search(
        symbol: string,
        display: number,
        cutoff: Date
    ): Promise<NewsItem[]> {
        const creds = credentials();
        if (!creds) return [];

        const query = await this.resolveQuery(symbol);
        if (!query) return [];

        const url = `${NAVER_NEWS_ENDPOINT}?${new URLSearchParams({
            query,
            display: String(Math.min(display, MAX_DISPLAY)),
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
                    // `X-Naver-Client-*` 헤더로는 401이 떨어진다(엔드포인트 주석 참조).
                    'X-NCP-APIGW-API-KEY-ID': creds.id,
                    'X-NCP-APIGW-API-KEY': creds.secret,
                },
                // 뉴스는 신선도가 핵심이라 상위 계층(news 테이블 + ISR 태그)이 캐싱을 맡는다.
                cache: 'no-store',
            });
        } catch (e) {
            console.warn('[naverNewsClient] fetch failed', symbol, e);
            return [];
        }

        if (!response.ok) {
            console.warn(
                '[naverNewsClient] non-OK response',
                symbol,
                response.status
            );
            return [];
        }

        const body = (await response.json()) as NaverNewsResponse;
        return (body.items ?? []).flatMap(raw => {
            const item = this.toNewsItem(raw, symbol);
            if (item === null) return [];
            return new Date(item.publishedAt) >= cutoff ? [item] : [];
        });
    }

    private toNewsItem(raw: NaverNewsItem, symbol: string): NewsItem | null {
        // 원문 링크를 우선한다 — 네이버 링크는 기사 이관 시 만료되지만 원문은 남는다.
        // 둘 다 없으면 URL이 id의 해시 입력이자 중복 제거 키라 기사를 버린다.
        const url = raw.originallink || raw.link;
        const publishedAt = toIsoPublishedAt(raw.pubDate);
        if (!url || !publishedAt || !raw.title) return null;

        const description = raw.description
            ? stripNaverMarkup(raw.description)
            : '';

        return {
            id: hashUrlToId(url),
            symbol,
            source: SOURCE_LABEL,
            url,
            publishedAt,
            // 필드명은 `titleEn`/`bodyEn`이지만 실제로는 "원문 언어"를 담는다 — 크립토·미국
            // 종목은 영문, 국내 종목은 한국어다. 어느 언어인지는 `sourceLanguage`가 알린다.
            titleEn: stripNaverMarkup(raw.title),
            // 본문은 제공되지 않는다(클래스 주석 참조). 요약이라도 넣어야 AI 분석이
            // 제목 한 줄만 보고 판단하지 않는다. 빈 문자열은 null로 정규화한다.
            bodyEn: description || null,
            // 네이버 기사는 이미 한국어다. 이 값이 없으면 core 프롬프트가 "영문을
            // 한국어로 번역하라"고 지시해, 토큰을 낭비할 뿐 아니라 이미 정확한 제목을
            // 모델이 조용히 고쳐 쓸 여지를 준다(core v0.45.0 `NewsItem.sourceLanguage`).
            // 요약·감성·분류는 언어와 무관하게 그대로 수행된다.
            sourceLanguage: 'ko',
            // 네이버 `description`은 본문 앞 ~120자를 기계적으로 잘라낸 조각이다
            // (실측 117~130자, 항상 `…`으로 끝남). AI 요약본이 아니다.
            bodyTruncated: detectTruncatedBody(description),
        };
    }
}
