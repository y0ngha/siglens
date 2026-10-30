import {
    toNewsCategory,
    toNewsImpact,
    toNewsSentiment,
} from '@/shared/lib/news/newsEnumCoercion';
import type { NewsRow } from '../api';

/** `news` 테이블에서 읽은 행 한 건의 형상. */
export interface NewsDbRow {
    id: string;
    symbol: string;
    source: string;
    url: string;
    publishedAt: Date;
    titleEn: string;
    /** 이 경로에서는 select하지 않는다 — {@link toNewsRow} 주석 참조. */
    bodyEn?: string | null;
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    sentiment: string | null;
    category: string | null;
    priceImpact: string | null;
    analyzedAt: Date | null;
}

/**
 * DB 행을 도메인 `NewsRow`로 바꾼다. DB는 sentiment/category/priceImpact를 raw text로
 * 저장하므로 read 시점에 화이트리스트로 검증한다. 잘못된 값(스키마 변경, 수동 SQL 등)은
 * null로 떨어뜨려 표시 단 fallback이 처리하게 한다.
 */
export function toNewsRow(row: NewsDbRow): NewsRow {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt.toISOString(),
        titleEn: row.titleEn,
        // `body_en`은 읽지 않는다 — 이 경로의 소비자(집계 분석 프롬프트)가 그 값을
        // 쓰지 않기 때문이다. core에서 `bodyEn`을 읽는 곳은 카드 프롬프트
        // (`newsCardPrompt`)뿐인데, 그쪽 입력은 DB 행이 아니라 FMP 응답 객체다
        // (`analyzeNewsCards(ingested.fresh)`). 즉 DB에서 원문을 실어 오면 전량
        // 버려진다.
        //
        // ⚠️ core가 집계/다이제스트 프롬프트에서 `bodyEn`을 읽기 시작하면 이 값이
        // 조용히 null이 되어 품질만 떨어진다. core 업그레이드 시
        // `grep -rn bodyEn node_modules/@y0ngha/siglens-core/dist`로 확인할 것.
        bodyEn: null,
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: toNewsSentiment(row.sentiment),
        category: toNewsCategory(row.category),
        priceImpact: toNewsImpact(row.priceImpact),
        analyzedAt: row.analyzedAt,
    };
}
