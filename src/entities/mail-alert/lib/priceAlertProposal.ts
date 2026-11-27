import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { PRICE_ALERT_BASIS_VALUES } from '@/shared/db/constants';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';
import type {
    PriceAlertBasis,
    PriceAlertCondition,
    PriceAlertProposal,
} from '../model';

/** 토큰 문자열 상한(자). 서명된 제안은 이보다 훨씬 짧다 — 형식을 읽기 전에 거른다(SA-7). */
export const PRICE_ALERT_TOKEN_MAX_LENGTH = 2_000;

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 모양과 함께 실제 달력 날짜인지 본다 — `2026-13-45`는 모양만 맞는다(SA-20). */
export function isIsoCalendarDate(value: unknown): value is string {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, value.length) === value
    );
}

const isPrice = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

function parseCondition(value: unknown): PriceAlertCondition | null {
    if (!isPlainRecord(value)) return null;
    if (value.kind === 'enter_zone') {
        const { low, high, approach } = value;
        if (!isPrice(low) || !isPrice(high) || low > high) return null;
        if (approach !== 'from_above' && approach !== 'from_below') return null;
        return { kind: 'enter_zone', low, high, approach };
    }
    if (value.kind === 'close_below' || value.kind === 'close_above') {
        return isPrice(value.level)
            ? { kind: value.kind, level: value.level }
            : null;
    }
    return null;
}

function isBasis(value: unknown): value is PriceAlertBasis {
    return PRICE_ALERT_BASIS_VALUES.some(basis => basis === value);
}

const isIsoInstant = (value: unknown): value is string =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * 신뢰할 수 없는 값(토큰 본문, 저장된 블록)을 제안으로 읽는다. 모양만이 아니라 의미도 본다 — 가격은 유한한
 * 양수, 구간은 low <= high, 날짜는 실제 달력 날짜, 종목은 허용 모양이다. 하나라도 어긋나면 `null`이라
 * 호출자는 그 값을 쓰지 않는다.
 */
export function parsePriceAlertProposal(
    value: unknown
): PriceAlertProposal | null {
    if (!isPlainRecord(value)) return null;
    const condition = parseCondition(value.condition);
    const {
        proposalId,
        subject,
        symbol,
        market,
        basis,
        analysisAt,
        referenceClose,
        quoteAt,
        startsAfterSession,
        expiresOn,
        exp,
    } = value;
    if (condition === null) return null;
    if (typeof proposalId !== 'string' || !UUID_RE.test(proposalId)) {
        return null;
    }
    if (typeof subject !== 'string' || subject.length === 0) return null;
    if (typeof symbol !== 'string' || !isAdmissibleSymbolShape(symbol)) {
        return null;
    }
    if (market !== 'us' && market !== 'kr') return null;
    if (!isBasis(basis)) return null;
    if (analysisAt !== null && !isIsoInstant(analysisAt)) return null;
    if (quoteAt !== null && !isIsoInstant(quoteAt)) return null;
    if (!isPrice(referenceClose)) return null;
    if (!isIsoCalendarDate(startsAfterSession)) return null;
    if (!isIsoCalendarDate(expiresOn)) return null;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
    return {
        proposalId,
        subject,
        symbol,
        market,
        condition,
        basis,
        analysisAt,
        referenceClose,
        quoteAt,
        startsAfterSession,
        expiresOn,
        exp,
    };
}
