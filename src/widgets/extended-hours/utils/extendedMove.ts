/**
 * 확장 세션 등락(금액·%)을 **보이는 반올림 값** 기준으로 방향·부호·색까지 정하는 순수 헬퍼.
 */
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import {
    formatPrice,
    formatPriceChange,
    resolvePriceDecimals,
} from '@/shared/lib/priceFormat';

/** 확장 시세는 미국 주식 전용이라 가격 표기 규칙을 `us-equity`로 고정한다. */
const EXTENDED_HOURS_PROFILE = 'us-equity';

/** 확장 시세 가격·등락 금액의 표기 규칙(`us-equity` 디스크립터). */
export const EXTENDED_HOURS_PRICE_FORMAT = getDescriptor(
    EXTENDED_HOURS_PROFILE
).priceFormat;

/** 등락률 표시 자릿수. */
const CHANGE_PERCENT_DIGITS = 2;

/** 보이는 등락의 방향. 금액·% 둘 다 0으로 반올림되면 `flat`이다. */
export type ExtendedMoveDirection = 'up' | 'down' | 'flat';

/** 등락 한 덩어리를 그리는 데 필요한 문자열·토큰. */
export interface ExtendedMoveDisplay {
    direction: ExtendedMoveDirection;
    /** 부호 붙은 금액(`+$3.42`·`-$1.75`·`$0.00`). */
    amountText: string;
    /** 부호 붙은 등락률(`+1.00%`·`-0.50%`·`0.00%`). */
    percentText: string;
    /** 방향 텍스트 색. 보합은 줄의 기본색을 그대로 쓴다(`null`). */
    colorClass: string | null;
    /** 방향 화살표. 보합은 화살표가 없다(`null`). */
    arrow: string | null;
}

const SIGN_BY_DIRECTION: Readonly<Record<ExtendedMoveDirection, string>> = {
    up: '+',
    down: '-',
    flat: '',
};

/** `value`가 `digits` 자리로 반올림했을 때 0인가 — 화면에 `0.00`으로 보이는 값이다. */
const roundsToZero = (value: number, digits: number): boolean =>
    Number(Math.abs(value).toFixed(digits)) === 0;

/**
 * 화면에 0이 아닌 값으로 보이는 쪽의 원시 값 — 금액이 먼저, 금액이 `$0.00`이면 %. 둘 다 0으로
 * 보이면 `null`(보합). 방향·부호·색을 모두 이 한 값에서 정해 보이는 숫자와 어긋나지 않게 한다.
 */
function visibleSignedValue(
    change: number,
    changePercent: number
): number | null {
    const shown = [
        {
            value: change,
            digits: resolvePriceDecimals(
                EXTENDED_HOURS_PROFILE,
                Math.abs(change)
            ),
        },
        { value: changePercent, digits: CHANGE_PERCENT_DIGITS },
    ].find(({ value, digits }) => !roundsToZero(value, digits));
    return shown === undefined ? null : shown.value;
}

/** 보이는 부호 값 → 방향. */
const directionFor = (signed: number | null): ExtendedMoveDirection => {
    if (signed === null) return 'flat';
    return signed > 0 ? 'up' : 'down';
};

/**
 * 등락 금액·%를 보이는 값 기준으로 꾸민다. 원시 값의 부호로 색·화살표를 정하면 `0`이나
 * 반올림해 `0.00`이 되는 미세 등락이 `▲ +$0.00 +0.00%`(녹색)·`▼ -$0.00 -0.00%`(적색)로
 * 보여 화면 숫자와 방향이 어긋난다. 그래서 둘 다 0으로 보이면 보합으로 두고, 부호는 크기가
 * 아니라 방향에서 붙인다(보합이 `-0.00`으로 새지 않는다). 금액이 한 센트라도 보여 방향이 정해지면
 * %가 `0.00`으로 반올림돼도 같은 부호를 붙인다(`-$0.01 -0.00%`) — 한 줄의 두 숫자가 서로 다른
 * 부호로 읽히지 않게 하기 위해서다.
 */
export function describeExtendedMove(
    change: number,
    changePercent: number
): ExtendedMoveDisplay {
    const signed = visibleSignedValue(change, changePercent);
    const direction = directionFor(signed);
    const sign = SIGN_BY_DIRECTION[direction];
    const amountText = `${sign}${formatPrice(Math.abs(change), EXTENDED_HOURS_PRICE_FORMAT)}`;
    const percentText = `${sign}${Math.abs(changePercent).toFixed(CHANGE_PERCENT_DIGITS)}%`;
    if (signed === null) {
        return {
            direction,
            amountText,
            percentText,
            colorClass: null,
            arrow: null,
        };
    }
    const { colorClass, arrow } = formatPriceChange(signed);
    return { direction, amountText, percentText, colorClass, arrow };
}
