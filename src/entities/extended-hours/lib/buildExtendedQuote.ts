import type { ExtendedHoursTrade } from '@/shared/api/market/marketProvider.types';
import {
    etDayNumber,
    previousTradingEtDay,
} from '@/shared/api/market/usSessionClock';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/shared/config/time';
import type { ExtendedHoursQuote } from '../model';
import type { ExtendedSessionWindow } from './extendedSession';

/** 서버·FMP 시계 차이 허용치 — 이보다 미래인 체결은 깨진 데이터로 본다. */
const TRADE_CLOCK_SKEW_MS = 5 * MS_PER_MINUTE;

/**
 * 애프터마켓 기준 종가 시각의 허용 오차. 종가 시세는 마감 직후(16:00:01 ET 실측)에 찍히지만,
 * 마감 직전(15:59:30)에 캐시된 스냅샷은 종가가 아니다 — 이만큼보다 더 이른 시각은 거른다.
 */
const REFERENCE_CLOSE_TOLERANCE_MS = 10 * MS_PER_SECOND;

/**
 * 등락 기준이 되는 정규장 종가의 출처 — `/quote` 스냅샷(`getQuote`)의 `price`·`timestamp`(초).
 * `/quote`는 정규장에만 갱신되므로 프리마켓에는 직전 세션 종가, 애프터마켓에는 오늘 종가가 남는다.
 */
export interface ReferenceQuote {
    price: number;
    timestampSec?: number;
}

/** `buildExtendedQuote` 입력 — 세션 창, 마지막 확장 체결, 기준 종가, 판정 시각(epoch ms). */
interface BuildExtendedQuoteInput {
    window: ExtendedSessionWindow;
    trade: ExtendedHoursTrade | null;
    reference: ReferenceQuote | null;
    nowMs: number;
}

/** 가격·시각 필드가 양의 유한수인지 좁히는 가드. */
const isPositiveFinite = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * 마지막 확장 세션 체결과 기준 종가로 한 줄 시세를 만든다. 근거가 하나라도 어긋나면 `null`이다
 * — 틀린 등락을 보이느니 아무것도 보이지 않는 편이 낫다.
 *
 * - 체결은 **이 세션 창 안**이어야 한다. 프리마켓 초입에 FMP가 어제 애프터마켓 마지막 체결을
 *   그대로 돌려주는 경우를 여기서 거른다.
 * - 기준 종가는 프리마켓이면 **직전 거래일**(주말·휴장일 건너뜀, 여러 거래일 묵은 시세는 거부),
 *   애프터마켓이면 오늘의 **마감 시각 이후**(허용 오차 10초) 스냅샷이어야 한다. 낡았거나(날짜
 *   어긋남) 마감 전에 캐시된 값이거나 시각이 없으면 기준을 확인할 수 없어 `null`이다.
 */
export function buildExtendedQuote({
    window,
    trade,
    reference,
    nowMs,
}: BuildExtendedQuoteInput): ExtendedHoursQuote | null {
    if (trade === null || reference === null) return null;
    if (!isPositiveFinite(trade.price) || !isPositiveFinite(reference.price)) {
        return null;
    }
    const { timestampMs } = trade;
    if (
        !Number.isFinite(timestampMs) ||
        timestampMs < window.startMs ||
        timestampMs >= window.endMs ||
        timestampMs > nowMs + TRADE_CLOCK_SKEW_MS
    ) {
        return null;
    }
    if (!isPositiveFinite(reference.timestampSec)) return null;
    const referenceMs = reference.timestampSec * MS_PER_SECOND;
    const referenceDay = etDayNumber(referenceMs);
    // 프리마켓: 기준은 **직전 거래일**의 종가여야 한다(여러 거래일 묵은 시세는 거른다).
    // 애프터마켓: 오늘 종가여야 한다 — 마감(반장일은 13:00)보다 허용 오차 넘게 이른 스냅샷은
    // 종가가 아니다.
    const referenceOk =
        window.kind === 'pre-market'
            ? referenceDay === previousTradingEtDay(window.etDay)
            : referenceDay === window.etDay &&
              referenceMs >= window.startMs - REFERENCE_CLOSE_TOLERANCE_MS;
    if (!referenceOk) return null;

    const change = trade.price - reference.price;
    return {
        session: window.kind,
        price: trade.price,
        referenceClose: reference.price,
        change,
        changePercent: (change / reference.price) * 100,
        tradedAtMs: timestampMs,
    };
}
