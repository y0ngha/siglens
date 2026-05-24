'use client';

import {
    ET_MARKET_HOURS_DISPLAY,
    KST_EDT_HOURS_DISPLAY,
    KST_EST_HOURS_DISPLAY,
} from '@/entities/options-chain/lib/marketHoursDisplay';
import { EDT_OFFSET_HOURS, getEasternOffsetHours } from '@/shared/lib/eastern';

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
 * EST: 23:30~06:00)을 모두 병기하되, 현재 어느 구간인지(`isCurrentlyEdt`)도
 * 함께 안내해 사용자가 자기 KST 시계로 바로 환산할 수 있도록 한다.
 *
 * 모든 시간 표기(ET 정규장 + KST 환산 + 현재 EDT/EST 판정)는
 * `@/entities/options-chain/lib/marketHoursDisplay`를 single source of truth로 사용한다 —
 * 같은 ET/KST 환산 문자열을 쓰는 `OpenInterestChart`의 빈 데이터 안내와
 * 표기가 자동으로 일치한다.
 *
 * `'use client'`: 현재 시각으로 EDT/EST를 판정해야 하므로 client 렌더링.
 * cacheComponents 비활성 상태라 RSC로 두면 빌드/요청 시점에 한 번만
 * 평가되어 DST 경계를 가로질러 사용자가 보는 페이지가 잘못 안내될 수 있다.
 */
export function OptionsStaleDataBanner() {
    // DST 판정은 `shared/lib/eastern`의 getEasternOffsetHours를 사용한다.
    const inEdt = getEasternOffsetHours(new Date()) === EDT_OFFSET_HOURS;
    const currentKstWindow = inEdt
        ? KST_EDT_HOURS_DISPLAY
        : KST_EST_HOURS_DISPLAY;
    const currentDstLabel = inEdt ? '서머타임(EDT)' : '표준시(EST)';

    return (
        <div
            role="status"
            className="border-ui-warning bg-ui-warning/10 text-ui-warning rounded-lg border px-3 py-2 text-xs leading-relaxed"
        >
            <p className="font-semibold">옵션 OI 데이터가 비어 있어요</p>
            <div className="text-ui-warning/90 mt-1 space-y-1">
                <p>
                    미국 정규장 마감 후에는 Yahoo가 Open Interest, 호가, IV 같은
                    수치를 갱신하지 않아 일시적으로 공백이에요.
                </p>
                <p>
                    정확한 수치는 미국 정규장 시간({ET_MARKET_HOURS_DISPLAY},
                    평일)에 다시 확인해 주세요.
                </p>
                <p>
                    한국 시간으로는 서머타임(EDT) 기간이면{' '}
                    {KST_EDT_HOURS_DISPLAY}, 표준시(EST) 기간이면{' '}
                    {KST_EST_HOURS_DISPLAY}이에요.
                </p>
                <p>
                    지금은 {currentDstLabel} 기간이니, {currentKstWindow}에
                    확인해 주세요.
                </p>
            </div>
        </div>
    );
}
