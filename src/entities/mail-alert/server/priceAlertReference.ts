import 'server-only';

import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { quoteWithTimeout } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { MS_PER_SECOND } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { zonedDate } from '@/shared/lib/marketSessionDate';

/** 알림을 만들 때 읽는 가격: 지금 시세와, 판정의 기준이 되는 마지막 마감 세션의 종가. */
export interface PriceAlertReference {
    /** 지금 시세. 조건이 이미 충족됐는지(`priceLevelStart`)는 이 값으로 본다. */
    readonly price: number;
    /** 시세 시각(ISO). 공급자가 시각을 주지 않으면 null. */
    readonly quoteAt: string | null;
    /**
     * `startsAfterSession` 세션의 종가 — 발송기의 분할 판정(`PRICE_ALERT_SCALE_GUARD`)이 지금 읽은 일봉의 그 세션 종가와
     * 견주는 값이다. 장중 시세를 쓰면 하루 +70% 같은 등락이 분할로 오인된다.
     */
    readonly referenceClose: number;
}

const isUsable = (value: number | undefined): value is number =>
    value !== undefined && Number.isFinite(value) && value > 0;

/** 일봉에서 그 세션의 종가. 봉이 없거나 못 읽으면 null(읽기 실패는 로그만 남긴다). */
async function closeFromBars(
    profile: MarketProfileId,
    symbol: string,
    quoteSymbol: string,
    startsAfterSession: string
): Promise<number | null> {
    try {
        const session = sessionSpecFor(profile);
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            '1Day',
            quoteSymbol === symbol ? undefined : quoteSymbol,
            session
        );
        // 일봉의 세션 날짜는 봉 시각의 UTC 날짜다(발송기 `sessionOfTime`과 같다).
        const bar = bars.find(
            candidate =>
                toUtcIsoDate(new Date(candidate.time * MS_PER_SECOND)) ===
                    startsAfterSession && isUsable(candidate.close)
        );
        return bar === undefined ? null : bar.close;
    } catch (error) {
        console.error(
            '[priceAlertReference] daily bars failed:',
            redactDbErrorForLog(error)
        );
        return null;
    }
}

/**
 * 봉을 못 읽을 때의 대체: 시세가 `startsAfterSession` 뒤 세션의 것이면(장중) 전일 대비 등락률로 전 세션 종가를 거꾸로
 * 계산하고, 그 세션의 마감 이후 시세면 시세 자체가 그 종가다.
 */
function closeFromQuote(
    profile: MarketProfileId,
    quote: { price: number; changesPercentage: number; timestamp?: number },
    startsAfterSession: string,
    now: Date
): number | null {
    const spec = sessionSpecFor(profile);
    const timeZone = spec.kind === 'scheduled' ? spec.timeZone : 'UTC';
    const quoteDate = zonedDate(
        quote.timestamp === undefined
            ? now
            : new Date(quote.timestamp * MS_PER_SECOND),
        timeZone
    );
    if (quoteDate <= startsAfterSession) return quote.price;
    const factor = 1 + quote.changesPercentage / 100;
    return Number.isFinite(factor) && factor > 0 ? quote.price / factor : null;
}

/**
 * 알림을 만드는 데 필요한 가격을 읽는다: 시세(공유 캐시, 5초 상한)와 `startsAfterSession` 세션의 종가. 시세를 못 읽거나
 * 종가를 알 수 없으면 `null`이라 호출자는 알림을 만들지 않는다. 절대 던지지 않는다.
 */
export async function readPriceAlertReference(input: {
    readonly symbol: string;
    readonly quoteSymbol: string;
    readonly profile: MarketProfileId;
    readonly startsAfterSession: string;
    readonly now: Date;
}): Promise<PriceAlertReference | null> {
    const { symbol, quoteSymbol, profile, startsAfterSession, now } = input;
    const quote = await Promise.resolve()
        .then(() =>
            quoteWithTimeout(
                getCachedMarketDataProvider(sessionSpecFor(profile)),
                quoteSymbol
            )
        )
        .catch((error: unknown) => {
            console.error(
                '[priceAlertReference] quote failed:',
                redactDbErrorForLog(error)
            );
            return null;
        });
    if (quote === null || !isUsable(quote.price)) return null;
    const referenceClose =
        (await closeFromBars(
            profile,
            symbol,
            quoteSymbol,
            startsAfterSession
        )) ?? closeFromQuote(profile, quote, startsAfterSession, now);
    if (referenceClose === null || !isUsable(referenceClose)) return null;
    return {
        price: quote.price,
        quoteAt:
            quote.timestamp !== undefined && Number.isFinite(quote.timestamp)
                ? new Date(quote.timestamp * MS_PER_SECOND).toISOString()
                : null,
        referenceClose,
    };
}
