import type {
    PublishableHistory,
    ScoredReading,
} from '@/entities/market-fear-greed/lib/publishableHistory';
import {
    FEAR_GREED_HUB_PATH,
    type FearGreedDataMarket,
} from '@/shared/config/fearGreedData';
import { METHODOLOGY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * 파일 공개 캐시 헤더. 값은 RSS·sitemap과 같다(1시간 신선 + 1시간 stale) — 점수는 세션당
 * 한 번 바뀌므로 그보다 짧게 둘 이유가 없다.
 */
export const FEAR_GREED_DATA_CACHE_CONTROL =
    'public, max-age=3600, stale-while-revalidate=3600';

/**
 * 날짜가 어느 시간대의 달력일인가. 미국·한국은 그 거래소의 세션 날짜이고, 크립토는 닫힌
 * UTC 일이다.
 */
const DATE_TIME_ZONE: Record<FearGreedDataMarket, string> = {
    us: 'America/New_York',
    kr: 'Asia/Seoul',
    crypto: 'UTC',
};

/*
 * 내려받기 파일 본문. 날짜·정수 점수·core 구간 라벨만 싣는다 — 종가나 요인 원값은 제3자 시세
 * 데이터라 재배포하지 않는다. 중간의 빈 날(점수 없음)은 건너뛴다.
 *
 * 버전 규칙: CSV 열과 JSON 키는 덧붙이기만 한다. 호환이 깨지는 변경은 새 경로(`data-v2.csv`)로
 * 내고 `schemaVersion`을 올린다. 크기 상한은 약 1,700점 기준 CSV 45KB, JSON 85KB.
 */

/** `date,score,label` 헤더 + 점마다 한 줄. `\n` 줄바꿈, 끝 줄바꿈 있음, BOM 없음. */
export function toFearGreedCsv(points: readonly ScoredReading[]): string {
    const lines = points.map(
        ({ date, score, label }) => `${date},${score},${label}`
    );
    return ['date,score,label', ...lines].join('\n') + '\n';
}

export interface FearGreedJsonFile {
    schemaVersion: 1;
    market: FearGreedDataMarket;
    asOf: string;
    dateTimeZone: string;
    scoreRange: { min: number; max: number };
    source: string;
    methodology: string;
    license: string;
    points: Array<{ date: string; score: number; label: string }>;
}

/**
 * JSON 파일 객체. 공개 하한을 통과한 기록(`publishableHistory`)만 받으므로 `asOf`는 늘 마지막
 * 점의 날짜이고 점은 하한 이상이다.
 */
export function toFearGreedJson(
    market: FearGreedDataMarket,
    { asOf, points: scored }: PublishableHistory
): FearGreedJsonFile {
    const points = scored.map(({ date, score, label }) => ({
        date,
        score,
        label,
    }));
    return {
        schemaVersion: 1,
        market,
        asOf,
        dateTimeZone: DATE_TIME_ZONE[market],
        scoreRange: { min: 0, max: 100 },
        source: `${SITE_URL}${FEAR_GREED_HUB_PATH[market]}`,
        methodology: `${SITE_URL}${METHODOLOGY_PATH}#fear-greed`,
        license: `${SITE_URL}${TERMS_PATH}`,
        points,
    };
}
