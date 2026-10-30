import type { NewsItem } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import type { RawFmpNews } from '@/shared/api/fmp/types';
import { detectTruncatedBody } from '@/shared/lib/news/detectTruncatedBody';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';
import { normalizeFmpPublishedDate } from '@/shared/api/fmp/normalizeFmpPublishedDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * 날짜 정규화 실패 경고를 프로세스당 한 번으로 줄이는 플래그. 잘못된 FMP 배치는 한
 * 응답에 깨진 행이 수십 개일 수 있어, 행마다 `console.warn`을 찍으면 신호 없이 로그만
 * 불어난다 — 운영자에게 알리는 데는 한 번이면 충분하다.
 */
let hasWarnedNormalizeFailure = false;

/** 정규화에 실패한 행은 던지지 않고 `null`로 돌려 호출부가 건너뛰게 한다. */
function tryNormalizeFmpPublishedDate(value: string): string | null {
    try {
        return normalizeFmpPublishedDate(value);
    } catch {
        if (!hasWarnedNormalizeFailure) {
            hasWarnedNormalizeFailure = true;
            console.warn(`[newsClient] failed to normalize date: ${value}`);
        }
        return null;
    }
}

/** `fetchNewsForPeriod` 한 요청이 받는 최대 기사 수. */
const LONG_PERIOD_LIMIT = 1000;

/**
 * `site`가 비어 있고 `url`도 URL로 해석되지 않을 때 쓰는 출처 대체값. 테스트가 리터럴을
 * 복제하지 않고 이 상수를 import해 검증한다.
 */
export const SOURCE_UNKNOWN_FALLBACK = 'unknown';

/**
 * FMP 크립토 뉴스는 타입 선언(`site: string`)과 달리 `site`를 null로 주기도 한다.
 * 호스트명으로 대체해 NOT NULL인 `source` 컬럼을 스키마 변경 없이 항상 채운다.
 */
function resolveSource(raw: RawFmpNews): string {
    if (raw.site) return raw.site;
    try {
        return new URL(raw.url).hostname;
    } catch {
        return SOURCE_UNKNOWN_FALLBACK;
    }
}

function mapRawToNewsItem(raw: RawFmpNews, publishedAt: string): NewsItem {
    return {
        id: hashUrlToId(raw.url),
        symbol: raw.symbol,
        source: resolveSource(raw),
        url: raw.url,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.text,
        // FMP도 전문이 아니라 리드 조각을 주는 일이 잦다 — 실측(2026-08-17)에서
        // `news/stock` 10건 중 8건이 문장 중간에서 끊겼다(`…during the quarter. Apple makes`).
        // 네이버와 달리 `...` 표식이 없어 눈에 띄지 않았을 뿐이다.
        bodyTruncated: detectTruncatedBody(raw.text),
    };
}

/** FMP 뉴스 어댑터. 모든 HTTP 호출은 `fmpGet`을 거친다. */
export class FmpNewsClient {
    /**
     * @param newsSource - FMP 뉴스 경로 조각. 'stock'은 `news/stock`(기본, 미국 주식),
     * 'crypto'는 `news/crypto`(심볼 태그, 응답 형상 동일).
     */
    constructor(private readonly newsSource: 'stock' | 'crypto' = 'stock') {}

    /**
     * 지금부터 `lookbackMs` 이전까지의 기사를 가져온다. FMP의 `from` 파라미터를 쓰므로
     * 30일을 넘는 기간(예: 6개월)도 한 요청으로 덮는다. 날짜를 해석할 수 없거나 창 밖인
     * 행은 버린다.
     */
    async fetchNewsForPeriod(
        symbol: string,
        lookbackMs: number
    ): Promise<NewsItem[]> {
        const cutoff = new Date(Date.now() - lookbackMs);
        const raw = await fmpGet<RawFmpNews[]>(`news/${this.newsSource}`, {
            symbols: symbol,
            limit: String(LONG_PERIOD_LIMIT),
            from: toUtcIsoDate(cutoff),
        });
        return raw
            .map(n => ({
                raw: n,
                publishedAt: tryNormalizeFmpPublishedDate(n.publishedDate),
            }))
            .filter(
                (n): n is { raw: RawFmpNews; publishedAt: string } =>
                    n.publishedAt !== null && new Date(n.publishedAt) >= cutoff
            )
            .map(({ raw, publishedAt }) => mapRawToNewsItem(raw, publishedAt));
    }
}
