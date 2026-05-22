import {
    MARKET_CLOSE_HOUR,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
} from '@/domain/market/session';

/**
 * Surfaces a "data temporarily empty" notice when the upstream provider
 * (Yahoo Finance) returns zero open interest on every strike of every chain.
 *
 * Background: Yahoo's options endpoint drops quote-side fields (openInterest,
 * bid/ask, IV) during U.S. pre-pre and post-post sessions, even though the
 * trade-side fields (volume, lastPrice) remain populated. Users hitting the
 * page during KST daytime (≈ ET overnight) see Max Pain = $0 / Top OI = 0
 * across the board. The banner explains why instead of letting the chart
 * silently render an empty distribution.
 *
 * KST 시각은 EDT/EST 구간별로 한 시간씩 어긋나므로, 두 구간(EDT: 22:30~05:00,
 * EST: 23:30~06:00)을 모두 병기해 사용자가 현재 시점이 어느 구간인지와
 * 무관하게 자기 KST 시계로 환산할 수 있도록 한다.
 *
 * NOTE: The ET hours below are derived from `session.ts` constants
 * (MARKET_OPEN_HOUR / MARKET_OPEN_MINUTE / MARKET_CLOSE_HOUR). The KST
 * conversions (EDT 22:30~05:00, EST 23:30~06:00) remain hardcoded and
 * must be manually re-synced if those constants change — DST offset math
 * (EDT +13h, EST +14h with day-rollover) was deferred to keep this static
 * banner simple.
 */
const ET_HOURS_DISPLAY = `ET ${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(2, '0')} ~ ${MARKET_CLOSE_HOUR}:00`;

export function OptionsStaleDataBanner() {
    return (
        <div
            role="status"
            className="border-ui-warning bg-ui-warning/10 text-ui-warning rounded-lg border px-3 py-2 text-xs leading-relaxed"
        >
            <p className="font-semibold">옵션 OI 데이터가 비어 있어요</p>
            <p className="text-ui-warning/90 mt-1">
                미국 정규장 마감 후에는 Yahoo가 Open Interest, 호가, IV 같은
                수치를 갱신하지 않아 일시적으로 공백이에요. 정확한 수치는 미국
                정규장 시간({ET_HOURS_DISPLAY}, 평일)에 다시 확인해 주세요 —
                한국 시간으로는 서머타임(EDT) 기간이면 22:30~05:00, 표준시(EST)
                기간이면 23:30~06:00이에요.
            </p>
        </div>
    );
}
