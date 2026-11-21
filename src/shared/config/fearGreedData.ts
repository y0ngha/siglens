/**
 * 공포·탐욕 지수 기록 내려받기 파일의 경로 계약.
 *
 * `next.config.ts`가 이 모듈을 직접 import하므로 `@/` 별칭을 쓰지 않는다(상대 import만).
 * 시장 id 타입은 `shared/lib/marketFearGreedLabels`의 `FearGreedMarketId`와 같은 집합이며,
 * 테스트가 두 목록이 어긋나지 않는지 대조한다.
 */
export const FEAR_GREED_DATA_MARKETS = ['us', 'kr', 'crypto'] as const;
export type FearGreedDataMarket = (typeof FEAR_GREED_DATA_MARKETS)[number];

export const FEAR_GREED_DATA_FORMATS = ['csv', 'json'] as const;
export type FearGreedDataFormat = (typeof FEAR_GREED_DATA_FORMATS)[number];

/** 허브 경로. `app/[locale]/fear-greed/copy.ts`의 `path`와 같아야 한다(테스트가 대조). */
export const FEAR_GREED_HUB_PATH: Record<FearGreedDataMarket, string> = {
    us: '/fear-greed',
    kr: '/fear-greed/kr',
    crypto: '/fear-greed/crypto',
};

/** 공개 경로. 로케일 접두가 없다 — 파일은 언어가 없고 모든 로케일이 같은 URL을 가리킨다. */
export function fearGreedDataPath(
    market: FearGreedDataMarket,
    format: FearGreedDataFormat
): string {
    return `${FEAR_GREED_HUB_PATH[market]}/data.${format}`;
}

/** rewrite가 가리키는 내부 라우트 핸들러 경로. */
export function fearGreedDataApiPath(
    market: FearGreedDataMarket,
    format: FearGreedDataFormat
): string {
    return `/api/fear-greed/data/${market}/${format}`;
}

export function fearGreedDataFileName(
    market: FearGreedDataMarket,
    format: FearGreedDataFormat
): string {
    return `siglens-fear-greed-${market}.${format}`;
}

/** schema.org `DataDownload.encodingFormat`. */
export const FEAR_GREED_DATA_MEDIA_TYPE: Record<FearGreedDataFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
};

/**
 * 여섯 개 공개 경로 → 라우트 핸들러 rewrite. 루트 쪽 파일은 `[locale]/[symbol]` 동적
 * 라우트에 지므로 RSS와 같이 rewrite로 연결한다.
 */
export const FEAR_GREED_DATA_REWRITES: ReadonlyArray<{
    source: string;
    destination: string;
}> = FEAR_GREED_DATA_MARKETS.flatMap(market =>
    FEAR_GREED_DATA_FORMATS.map(format => ({
        source: fearGreedDataPath(market, format),
        destination: fearGreedDataApiPath(market, format),
    }))
);

/** 라우트 파라미터를 검증한다. 목록 밖(대소문자 포함)이면 `null`. */
export function parseFearGreedDataParams(
    market: string,
    format: string
): { market: FearGreedDataMarket; format: FearGreedDataFormat } | null {
    const knownMarket = FEAR_GREED_DATA_MARKETS.find(m => m === market);
    const knownFormat = FEAR_GREED_DATA_FORMATS.find(f => f === format);
    return knownMarket === undefined || knownFormat === undefined
        ? null
        : { market: knownMarket, format: knownFormat };
}
