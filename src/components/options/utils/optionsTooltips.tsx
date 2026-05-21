/**
 * Shared tooltip JSX for options-page metrics.
 *
 * Two components surface the same metrics — `OptionsSignalCards` (chart-page
 * chips) and `OptionsMetricsRow` (options-tab grid) — so the explanation
 * copy must agree. Centralising the JSX here prevents silent drift when one
 * site is reworded and the other is forgotten.
 *
 * Each constant is a JSX fragment with multiple `<p>` blocks; consumers
 * render them inside `<InfoTooltip>`.
 */

export const MaxPainTooltip = (
    <>
        <p>옵션 만기일이 가까워질수록 주가가 끌리는 가격이에요.</p>
        <p>
            옵션을 판 쪽(주로 기관)의 손실이 가장 적어지는 가격이라, 만기일
            부근에는 주가가 이쪽으로 움직이는 경향이 있어요.
        </p>
        <p>절대 법칙은 아니고 참고용 가격으로 보세요.</p>
    </>
);

export const PutCallRatioTooltip = (
    <>
        <p>풋옵션 거래량을 콜옵션 거래량으로 나눈 값이에요.</p>
        <p>
            1보다 크면 풋(하락 베팅)이 더 많아 시장이 조심스럽다는 뜻이고, 1보다
            작으면 콜(상승 베팅)이 더 많다는 뜻이에요.
        </p>
        <p>
            너무 극단으로 치우치면 오히려 반대 신호로 해석하는 경우도 많아요 —
            모두 두려워할 때가 바닥인 경우가 있거든요.
        </p>
    </>
);

export const AtmIvTooltip = (
    <>
        <p>현재 주가에 가장 가까운 옵션이 반영하고 있는 예상 변동성이에요.</p>
        <p>어닝 발표 직전에 보통 올라가요.</p>
    </>
);

export const ImpliedMoveTooltip = (
    <>
        <p>
            옵션 시장이 &ldquo;이 주식이 앞으로 얼마나 출렁일 것 같다&rdquo;고
            가격에 반영해놓은 폭이에요.
        </p>
        <p>
            예를 들어 ±4%라면 시장은 다음 만기일까지 주가가 ±4% 정도 움직일
            가능성이 높다고 보고 있는 거예요.
        </p>
        <p>어닝 같은 큰 이벤트 직전에는 이 값이 평소보다 커져요.</p>
    </>
);
