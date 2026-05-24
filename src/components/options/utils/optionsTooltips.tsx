'use client';

/**
 * Shared tooltip JSX for options-page metrics.
 *
 * Multiple components surface the same metrics — `OptionsMetricsRow`
 * (options-tab grid), `OpenInterestChart` (OI distribution chart header),
 * and `OptionsChainTable` (chain table OI column) — so the explanation copy
 * must agree. Centralising the JSX here prevents silent drift when one site
 * is reworded and the others are forgotten.
 *
 * 대부분 const JSX fragment로 두지만, 한국 시간/DST에 따라 본문이 달라지는
 * 안내(ATM IV·Imp. Move)는 함수 컴포넌트로 둔다 — module-level const는 import
 * 시점에만 평가돼 DST 경계를 가로지르는 사용자에게 잘못된 시간을 보여준다.
 *
 * `'use client'`: `AtmIvTooltip`/`ImpliedMoveTooltip`은 render 시점에
 * `getEasternOffsetHours(new Date())`를 호출해 DST 윈도우를 분기한다. RSC에서
 * import되면 build/요청 시점의 한 시점만 평가돼 DST 경계를 건너는 사용자에게
 * 잘못된 한국 시간 안내가 굳어버리므로, OptionsStaleDataBanner와 동일하게
 * 클라이언트에서만 렌더되도록 강제한다.
 */

import { EDT_OFFSET_HOURS, getEasternOffsetHours } from '@/shared/lib/eastern';
import {
    ET_MARKET_HOURS_DISPLAY,
    KST_EDT_HOURS_DISPLAY,
    KST_EST_HOURS_DISPLAY,
} from '@/lib/options/marketHoursDisplay';

interface KstWindowInfo {
    window: string;
    label: string;
}

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
        <p>너무 극단으로 치우치면 오히려 반대 신호로 해석하는 경우도 많아요.</p>
        <p>모두 두려워할 때가 바닥인 경우가 있거든요.</p>
    </>
);

function getCurrentKstWindow(): KstWindowInfo {
    const inEdt = getEasternOffsetHours(new Date()) === EDT_OFFSET_HOURS;
    return inEdt
        ? { window: KST_EDT_HOURS_DISPLAY, label: '서머타임(EDT)' }
        : { window: KST_EST_HOURS_DISPLAY, label: '표준시(EST)' };
}

export function AtmIvTooltip() {
    const { window: kstWindow, label } = getCurrentKstWindow();
    return (
        <>
            <p>
                현재 주가에 가장 가까운 옵션이 반영하고 있는 예상 변동성이에요.
            </p>
            <p>어닝 발표 직전에 보통 올라가요.</p>
            <br />
            <p>
                <strong>&lsquo;—&rsquo;로 표시될 때</strong>: 미국 정규장 마감
                후나 pre-market에는 Yahoo가 ATM 옵션의 IV를 0으로 클리어해
                보내는 경우가 있어서 정확한 수치를 받을 수 없어요. 한국 시간
                기준으로 평일 {kstWindow}(미국 정규장, {ET_MARKET_HOURS_DISPLAY}
                ) 에 다시 확인해 주세요. 지금은 {label} 기간이에요.
            </p>
        </>
    );
}

export function ImpliedMoveTooltip() {
    const { window: kstWindow, label } = getCurrentKstWindow();
    return (
        <>
            <p>
                옵션 시장이 &ldquo;이 주식이 앞으로 얼마나 출렁일 것 같다&rdquo;
                고 가격에 반영해놓은 폭이에요.
            </p>
            <p>
                예를 들어 ±4%라면 시장은 다음 만기일까지 주가가 ±4% 정도 움직일
                가능성이 높다고 보고 있는 거예요.
            </p>
            <p>어닝 같은 큰 이벤트 직전에는 이 값이 평소보다 커져요.</p>
            <br />
            <p>
                <strong>&lsquo;—&rsquo;로 표시될 때</strong>: ATM IV에서
                계산하기 때문에 ATM IV가 비어 있으면(정규장 외 시간 등) 같이
                비워져요. 또 만기 당일이면 남은 시간이 0이라 계산이 불가능해
                비어 보일 수 있어요. 한국 시간 기준으로 평일 {kstWindow}(미국
                정규장)에 다시 확인해 주세요. 지금은 {label} 기간이에요.
            </p>
        </>
    );
}

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
            위로 갈 것&rdquo;에 베팅을 많이 걸어둔 자리예요.
        </p>
        <p>
            추세가 살아 있을 때 저항선이 깨지면 가격을 위로 끌어당기는 자석처럼
            작용해요.
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
            좋겠다&rdquo;는 보험성 베팅이 쌓인 자리예요.
        </p>
        <p>주가가 가까이 가면 지지선처럼 작동하는 경우가 많아요.</p>
    </>
);

export const CallVolumeTooltip = (
    <>
        <p>오늘 새로 체결된 콜 옵션 계약 수예요.</p>
        <p>
            Call Vol이 많다 = 오늘 새로 콜에 베팅하는 사람이 많다 → 단기 강세
            기대가 활발하다는 뜻이에요.
        </p>
        <p>
            <strong>OI와 함께 읽기</strong>: Vol↑ + OI↑는 새 자금이 들어와
            추세가 강해지는 신호, Vol↑ + OI↓는 기존 포지션을 청산하며 추세가
            약해지는 신호, Vol이 적은데 OI가 두텁다면 자리잡은 베팅이 그대로
            남아 있다는 의미예요.
        </p>
    </>
);

export const PutVolumeTooltip = (
    <>
        <p>오늘 새로 체결된 풋 옵션 계약 수예요.</p>
        <p>
            Put Vol이 많다 = 오늘 새로 하락 베팅이나 헷지가 늘었다 → 단기 위험
            관리 수요가 강하다는 뜻이에요.
        </p>
        <p>
            <strong>OI와 함께 읽기</strong>: Vol↑ + OI↑는 새 헷지/하락 베팅이
            진짜 자금으로 들어오는 신호, Vol↑ + OI↓는 보유 포지션을 청산하는
            (헷지 해제 등) 신호, Vol이 낮은데 OI가 두텁다면 기존 보호 포지션이
            그대로 유지되고 있다는 의미예요.
        </p>
    </>
);
