const ZONELESS_DATE_TIME_RE =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;
const FMP_NEWS_TIME_ZONE = 'America/New_York';
const FMP_NEWS_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: FMP_NEWS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

/**
 * FMP stock news commonly returns `publishedDate` without a timezone
 * (`YYYY-MM-DD HH:mm:ss`). Those values are Eastern-market local time, so
 * normalize them through America/New_York before storing UTC in the DB.
 */
export function normalizeFmpPublishedDate(value: string): string {
    const match = ZONELESS_DATE_TIME_RE.exec(value);
    if (!match) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new Error(`Invalid FMP publishedDate: ${value}`);
        }
        return date.toISOString();
    }

    const [, year, month, day, hour, minute, second, ms = '0'] = match;
    const localUtcMs = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        Number(ms.padEnd(3, '0'))
    );
    const utcMs = convertEasternLocalToUtcMs(localUtcMs);
    return new Date(utcMs).toISOString();
}

/**
 * ET 벽시계(UTC로 읽은 값) → UTC 순간. 오프셋을 두 번 재는 이유: 첫 추정은 DST 전환일에
 * 전환 전/후 중 어느 쪽 오프셋인지 알 수 없어, 1차 보정한 순간에서 다시 재야 맞는 쪽에 든다.
 */
function convertEasternLocalToUtcMs(localUtcMs: number): number {
    const firstPass = localUtcMs - getEasternOffsetMs(localUtcMs);
    const secondPass = localUtcMs - getEasternOffsetMs(firstPass);
    return secondPass;
}

function getEasternOffsetMs(utcMs: number): number {
    const parts = FMP_NEWS_TIME_FORMATTER.formatToParts(new Date(utcMs));
    const values = Object.fromEntries(
        parts.flatMap(part =>
            part.type === 'literal' ? [] : [[part.type, part.value]]
        )
    );

    const easternAsUtcMs = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );
    return easternAsUtcMs - utcMs;
}
