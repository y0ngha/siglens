import { isLawFirmSolicitation } from '@/shared/lib/news/isLawFirmSolicitation';
import { detectTruncatedBody } from '@/shared/lib/news/detectTruncatedBody';
import { hashUrlToId } from '@/shared/lib/news/hashUrlToId';
import type { MarketNewsItem } from './marketNewsClientPort';

/** FMP `/stable/news/{general,stock,crypto,forex}-latest` 한 건의 형상. */
export interface RawFmpLatestNews {
    symbol: string | null;
    publishedDate: string;
    publisher?: string | null;
    title: string;
    site: string;
    text?: string | null;
    url: string;
}

/** FMP `/stable/fmp-articles` 한 건의 형상. */
export interface RawFmpArticle {
    title: string;
    date: string;
    content?: string | null;
    tickers?: string | null;
    link: string;
    author?: string | null;
    site: string;
}

/** 날짜 정규화·컷오프·광고 필터에 필요한 호출 맥락. */
export interface FmpSelectionContext {
    readonly sentinel: string;
    readonly cutoff: Date;
    /** 정규화할 수 없는 날짜는 `null` — 그 기사는 버린다. */
    readonly normalizeDate: (value: string) => string | null;
}

/** 피드 형상별로 달라지는 부분 — 선택 파이프라인은 둘이 공유한다. */
interface FmpFeedShape<R> {
    dateOf: (row: R) => string;
    titleOf: (row: R) => string;
    toItem: (row: R, publishedAt: string, sentinel: string) => MarketNewsItem;
}

/**
 * FMP articles의 콤마 구분 `tickers` 문자열을 맨 심볼 배열로 바꾼다.
 *
 * `"NASDAQ:AAPL,NYSE:MSFT"`처럼 거래소 접두사가 붙을 수 있어 접두사를 떼고,
 * 비었거나 없으면 `[]`를 돌려준다.
 */
export function parseArticleTickers(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .map(t => {
            const trimmed = t.trim();
            const colonIdx = trimmed.indexOf(':');
            return colonIdx >= 0 ? trimmed.slice(colonIdx + 1) : trimmed;
        })
        .filter(t => t.length > 0);
}

const LATEST_SHAPE: FmpFeedShape<RawFmpLatestNews> = {
    dateOf: raw => raw.publishedDate,
    titleOf: raw => raw.title,
    toItem: (raw, publishedAt, sentinel) => ({
        id: hashUrlToId(raw.url),
        symbol: sentinel,
        source: raw.publisher ?? raw.site,
        url: raw.url,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.text ?? null,
        // 시장 뉴스도 카드 분석(`runNewsCardAnalysis`)을 타므로 종목 뉴스와 같은 표기가
        // 필요하다 — 실측에서 `news/general-latest`는 10건 중 2건이 문장 중간에서 끊겼다.
        bodyTruncated: detectTruncatedBody(raw.text),
        tickers: raw.symbol ? [raw.symbol] : [],
    }),
};

const ARTICLE_SHAPE: FmpFeedShape<RawFmpArticle> = {
    dateOf: raw => raw.date,
    titleOf: raw => raw.title,
    toItem: (raw, publishedAt, sentinel) => ({
        id: hashUrlToId(raw.link),
        symbol: sentinel,
        source: raw.site,
        url: raw.link,
        publishedAt,
        titleEn: raw.title,
        bodyEn: raw.content ?? null,
        // `fmp-articles`는 본문이 2,500~5,900자로 길지만 그래도 종결부호 없이 끝난다
        // (실측 0/10 완결). 길이가 아니라 형상으로 판정하는 이유다.
        bodyTruncated: detectTruncatedBody(raw.content),
        tickers: parseArticleTickers(raw.tickers),
    }),
};

/**
 * 날짜를 정규화하고, lookback 컷오프 이전 기사와 로펌 원고 모집 광고를 버린 뒤 매핑한다.
 *
 * 광고 판정은 번역 전 영문 `title`로 **매핑 전에** 한다 — 광고는 뉴스가 아니고 남기면
 * 카드 분석 LLM 호출을 건당 쓴다. 날짜 정규화를 가장 먼저 해서 날짜가 깨진 기사는
 * 호출부의 경고 경로를 탄다.
 */
function selectItems<R>(
    rows: readonly R[],
    shape: FmpFeedShape<R>,
    { sentinel, cutoff, normalizeDate }: FmpSelectionContext
): MarketNewsItem[] {
    return rows.flatMap(row => {
        const publishedAt = normalizeDate(shape.dateOf(row));
        if (publishedAt === null) return [];
        if (new Date(publishedAt) < cutoff) return [];
        if (isLawFirmSolicitation(shape.titleOf(row))) return [];
        return [shape.toItem(row, publishedAt, sentinel)];
    });
}

/** `latest` 피드 행을 카테고리 버킷 기사로 선별·매핑한다. */
export function selectFmpLatestItems(
    rows: readonly RawFmpLatestNews[],
    context: FmpSelectionContext
): MarketNewsItem[] {
    return selectItems(rows, LATEST_SHAPE, context);
}

/** `fmp-articles` 행을 카테고리 버킷 기사로 선별·매핑한다. */
export function selectFmpArticleItems(
    rows: readonly RawFmpArticle[],
    context: FmpSelectionContext
): MarketNewsItem[] {
    return selectItems(rows, ARTICLE_SHAPE, context);
}
