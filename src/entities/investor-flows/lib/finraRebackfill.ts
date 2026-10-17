/**
 * FINRA 1회 재수집(`INVESTOR_FLOWS_STATE_FINRA_REBACKFILL`)의 진행 커서. 재수집은 **최근 날짜부터** 거꾸로 읽으므로, 커서는 "이
 * 날짜보다 옛 것만 남았다"는 상한이다(`null`이면 아직 하나도 안 읽음 = 가장 최근부터).
 */
export interface FinraRebackfillProgress {
    /** cusip-map이 재수집을 요청한 시각(ISO) — 로그·진단용. */
    requestedAt: string | null;
    /** 일별 거래량: 이 거래일(제외)보다 옛 저장일만 남았다. */
    volumeBefore: string | null;
    /** 공매도 잔고: 이 결제일(제외)보다 옛 저장일만 남았다. */
    interestBefore: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isoDateOrNull = (value: unknown): string | null =>
    typeof value === 'string' && ISO_DATE.test(value) ? value : null;

/** cusip-map이 전수 한 바퀴 표식과 함께 남기는 첫 값 — 아직 아무것도 다시 읽지 않았다. */
export function initialFinraRebackfillValue(now: Date): string {
    return serializeFinraRebackfillProgress({
        requestedAt: now.toISOString(),
        volumeBefore: null,
        interestBefore: null,
    });
}

/**
 * 저장된 값 → 진행 커서. 읽을 수 없는 값(손으로 넣은 `1`, 깨진 JSON)은 "처음부터"로 읽는다 — 재수집은 멱등 upsert라 처음부터
 * 다시 해도 해가 없고, 요청 자체를 잃는 쪽이 더 나쁘다.
 */
export function parseFinraRebackfillProgress(
    value: string
): FinraRebackfillProgress {
    const parsed = safeParse(value);
    if (parsed === null || typeof parsed !== 'object') {
        return { requestedAt: null, volumeBefore: null, interestBefore: null };
    }
    const record = parsed as Record<string, unknown>;
    return {
        requestedAt:
            typeof record.requestedAt === 'string' ? record.requestedAt : null,
        volumeBefore: isoDateOrNull(record.volumeBefore),
        interestBefore: isoDateOrNull(record.interestBefore),
    };
}

export function serializeFinraRebackfillProgress(
    progress: FinraRebackfillProgress
): string {
    return JSON.stringify(progress);
}

/** 저장된 날짜 중 커서보다 옛 것을 최근 것부터 — 이번 실행이 다시 읽을 후보 순서다. */
export function rebackfillDates(
    stored: Iterable<string>,
    before: string | null
): string[] {
    return [...stored]
        .filter(date => before === null || date < before)
        .toSorted()
        .toReversed();
}

function safeParse(value: string): unknown {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}
