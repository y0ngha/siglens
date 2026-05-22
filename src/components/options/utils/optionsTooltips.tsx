/**
 * Shared tooltip JSX for options-page metrics.
 *
 * Multiple components surface the same metrics — `OptionsMetricsRow`
 * (options-tab grid), `OpenInterestChart` (OI distribution chart header),
 * and `OptionsChainTable` (chain table OI column) — so the explanation copy
 * must agree. Centralising the JSX here prevents silent drift when one site
 * is reworded and the others are forgotten.
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

export const OpenInterestTooltip = (
    <>
        <p>특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.</p>
        <p>
            한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이 베팅했다는
            뜻이에요.
        </p>
    </>
);

export const CallOpenInterestTooltip = (
    <>
        <p>
            특정 strike에서 콜(상승) 옵션을 산 사람들이 아직 갖고 있는 계약
            수예요.
        </p>
        <p>
            이 가격에 콜 OI가 두텁다 = 시장 참여자들이 &ldquo;주가가 이 가격
            위로 갈 것&rdquo;에 베팅을 많이 걸어둔 자리예요. 추세가 살아 있으면
            저항이 깨졌을 때 빠르게 올라붙는 자석 같은 역할을 해요.
        </p>
    </>
);

export const PutOpenInterestTooltip = (
    <>
        <p>
            특정 strike에서 풋(하락) 옵션을 산 사람들이 아직 갖고 있는 계약
            수예요.
        </p>
        <p>
            이 가격에 풋 OI가 두텁다 = &ldquo;이 가격 아래로는 안 떨어졌으면
            좋겠다&rdquo;는 보험성 베팅이 쌓인 자리예요. 주가가 가까이 가면
            지지선처럼 작동하는 경우가 많아요.
        </p>
    </>
);

export const VolumeTooltip = (
    <>
        <p>오늘 새로 체결된 옵션 계약 수예요.</p>
        <p>
            OI(누적 베팅)와 Volume(오늘의 활동)을 함께 보면 시장이 어느 가격대로
            새로 움직이고 있는지 짚어볼 수 있어요.
        </p>
    </>
);
