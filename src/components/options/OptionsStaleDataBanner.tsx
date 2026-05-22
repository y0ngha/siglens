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
 * 본문 텍스트는 KST 시각을 명시하지 않는다 — 미국 서머타임(EDT, 3~11월)
 * 기준 KST 22:30~05:00이고, 표준시(EST, 11~3월) 기준 KST 23:30~06:00으로
 * 한 시간씩 어긋나기 때문이다. 대신 ET 기준 정규장 시간을 그대로 적고
 * "ET ↔ KST 시차는 -13/-14h" 한 줄로 사용자가 자기 KST 시계로 환산할 수
 * 있도록 안내한다.
 */
export function OptionsStaleDataBanner() {
    return (
        <aside
            role="status"
            aria-live="polite"
            className="border-ui-warning bg-ui-warning/10 text-ui-warning rounded-lg border px-3 py-2 text-xs leading-relaxed"
        >
            <p className="font-semibold">옵션 OI 데이터가 비어 있어요</p>
            <p className="text-ui-warning/90 mt-1">
                미국 정규장 마감 후에는 Yahoo가 Open Interest, 호가, IV 같은
                수치를 갱신하지 않아 일시적으로 공백이에요. 정확한 수치는 미국
                정규장 시간(ET 09:30 ~ 16:00, 평일)에 다시 확인해 주세요 — 한국
                시간으로는 서머타임(EDT) 기간이면 22:30~05:00, 표준시(EST)
                기간이면 23:30~06:00이에요.
            </p>
        </aside>
    );
}
