/**
 * 저장된 도구 결과의 시각 문자열을 다시 순간(ISO)으로 읽는다.
 *
 * core `runAgentTurn`은 도구 결과를 모델에게 넘기기 전에 `localizeTimestamps`로 시각(`Z`·`±HH:MM`이 붙은 ISO)을
 * 모두 `YYYY-MM-DD HH:MM <라벨>`(그 회원의 시간대, 예: `2026-11-28 15:44 KST`)로 바꾸고, siglens는 그 결과를 그대로
 * `chat_messages`에 저장한다. 그래서 저장된 대화의 `generatedAt`은 ISO가 아니다 — `Date.parse`만으로 읽으면 KST·JST·
 * 일반 이름 라벨("China Time")은 NaN이 되어 "그 분석 이후 달라진 점" 카드와 에이전트 `sinceEarlier`가 조용히 빠진다.
 *
 * 라벨 규칙은 core와 같다(`Asia/Seoul`→KST, `Asia/Tokyo`→JST, 그 밖은 `en-US`의 짧은 약어(EST·PDT·UTC 등)가
 * 대문자 2~5자일 때 그것, 아니면 짧은 일반 이름 — "China Time", 일반 이름이 없는 `Etc/GMT-9` 같은 곳은 `GMT+9`).
 * 오프셋을 그대로 적은 라벨(`UTC`·`GMT`·`GMT+9`·`GMT-3:30`)은 바로 그 오프셋으로 읽는다 — `Etc/GMT±N`은
 * `Intl.supportedValuesOf`에 없어 훑기로는 찾을 수 없다. 나머지 라벨은 어느 시간대인지 표로 두지 않고, 후보
 * 시간대에서 같은 문자열을 다시 만들어 보아 일치하는 순간을 찾는다. 같은 순간에 같은 라벨이 서로 다른 오프셋을
 * 가리키는 경우는 ICU 데이터에 없다(전 시간대 실측).
 *
 * 서머타임이 끝나며 같은 벽시계가 두 번 오는 시각은 약어가 바뀌는 시간대(01:30 EDT/EST)만 라벨로 갈린다. 일반 이름을
 * 쓰는 시간대("Cuba Time")는 두 순간의 라벨이 같아, 먼저 시도한 오프셋(그 벽시계에서 읽은 오프셋, 대개 전환 전)을
 * 고른다 — 1년에 한 번, 한 시간 안의 시각만 한 시간 어긋날 수 있다.
 *
 * 로컬 형식은 분 단위라 초 이하는 잃는다 — 돌려주는 값은 그 분의 0초다. 비교하는 쪽은 분 단위로 맞춰 읽는다.
 */

/** core `localizeTimestamps`가 건드리는 ISO 순간(명시 시간대) — 옛 저장 행·테스트는 이 모양 그대로다. */
const ISO_INSTANT_RE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** core `formatAgentTimestamp`의 출력 `YYYY-MM-DD HH:MM <라벨>`. */
const LOCALIZED_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (\S.*)$/;

/** 오프셋을 그대로 적은 라벨: `UTC`, `GMT`, `GMT+9`, `GMT-3:30`. */
const FIXED_OFFSET_LABEL_RE = /^(?:UTC|GMT)$|^GMT([+-])(\d{1,2})(?::(\d{2}))?$/;

/**
 * core가 만들 수 있는 라벨의 모양 — 대문자 약어 또는 `… Time`으로 끝나는 일반 이름("Bosnia & Herzegovina Time",
 * "Åland Islands Time"). 이 모양이 아니면 시간대를 훑지 않는다.
 */
const SCANNABLE_LABEL_RE =
    /^(?:[A-Z]{2,5}|\p{Lu}[\p{L}\p{M} .&'’()-]{0,58} Time)$/u;

/** 훑어도 맞는 시간대가 없던 값의 기억 상한. 넘치면 오래된 것부터 잊는다. */
const UNMATCHED_MAX = 256;

/** core의 `KNOWN_LABELS` — `Intl`이 `GMT+9`만 주는 곳에 독자가 아는 약어. */
const KNOWN_LABELS: Readonly<Record<string, string>> = {
    'Asia/Seoul': 'KST',
    'Asia/Tokyo': 'JST',
};

/** 먼저 볼 시간대 — core의 로케일별 기본값(ko·en·ja·zh)과 UTC. 대부분의 행은 여기서 끝난다. */
const PREFERRED_ZONES = [
    'Asia/Seoul',
    'America/New_York',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'UTC',
] as const;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const clockFormats = new Map<string, Intl.DateTimeFormat>();
const nameFormats = new Map<string, Intl.DateTimeFormat>();
/** 라벨 → 그 라벨로 한 번 맞았던 시간대. 전체 훑기를 한 번만 하게 한다. */
const zoneByLabel = new Map<string, string>();
/**
 * 전체 훑기에서 맞는 시간대가 없던 값(문자열 전체). 같은 값이 다시 와도 다시 훑지 않는다. 라벨만으로 기억하지 않는
 * 이유: 서머타임 시작으로 건너뛴 시각(`02:30 EDT`)처럼 라벨은 맞는데 그 시각만 없는 값이 있어, 라벨을 막으면 같은
 * 라벨의 정상 값까지 못 읽는다.
 */
const unmatched = new Set<string>();

function rememberUnmatched(value: string): void {
    if (unmatched.size >= UNMATCHED_MAX) {
        const oldest = unmatched.values().next();
        if (!oldest.done) unmatched.delete(oldest.value);
    }
    unmatched.add(value);
}

/** 오프셋 라벨이면 그 오프셋(ms), 아니면 `null`. */
function fixedOffsetMs(label: string): number | null {
    const match = FIXED_OFFSET_LABEL_RE.exec(label);
    if (match === null) return null;
    const [, sign, hours, minutes] = match;
    if (sign === undefined || hours === undefined) return 0;
    const h = Number(hours);
    const m = Number(minutes ?? '0');
    if (h > 14 || m > 59) return null;
    return (sign === '-' ? -1 : 1) * (h * 60 + m) * MINUTE_MS;
}

function cached(
    formats: Map<string, Intl.DateTimeFormat>,
    key: string,
    make: () => Intl.DateTimeFormat
): Intl.DateTimeFormat {
    const hit = formats.get(key);
    if (hit) return hit;
    const made = make();
    formats.set(key, made);
    return made;
}

function clockFormat(timeZone: string): Intl.DateTimeFormat {
    return cached(
        clockFormats,
        timeZone,
        () =>
            new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            })
    );
}

function zoneName(
    date: Date,
    timeZone: string,
    style: 'short' | 'shortGeneric'
): string {
    return (
        cached(
            nameFormats,
            `${style}|${timeZone}`,
            () =>
                new Intl.DateTimeFormat('en-US', {
                    timeZone,
                    timeZoneName: style,
                })
        )
            .formatToParts(date)
            .find(p => p.type === 'timeZoneName')?.value ?? ''
    );
}

/** core `timeZoneLabel`의 `Intl` 갈래(알려진 약어 표를 거치지 않은 값). */
function intlLabel(date: Date, timeZone: string): string {
    const short = zoneName(date, timeZone, 'short');
    return /^[A-Z]{2,5}$/.test(short)
        ? short
        : zoneName(date, timeZone, 'shortGeneric');
}

/** 그 시간대의 벽시계를 UTC인 것처럼 읽은 밀리초(분 단위). */
function wallMs(date: Date, timeZone: string): number {
    const parts = clockFormat(timeZone).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
        Number(parts.find(p => p.type === type)?.value);
    return Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute')
    );
}

/** 그 순간의 UTC 대비 오프셋(ms). */
function offsetMs(instantMs: number, timeZone: string): number {
    const floored = Math.floor(instantMs / MINUTE_MS) * MINUTE_MS;
    return wallMs(new Date(floored), timeZone) - floored;
}

/**
 * 벽시계 `wall`(UTC로 읽은 ms)과 라벨이 `timeZone`에서 core가 만들었을 문자열과 맞는 순간. 전환 앞뒤의 오프셋을
 * 모두 시도해 서머타임 겹침의 두 순간 중 라벨이 맞는 쪽을 고른다.
 */
function instantIn(
    wall: number,
    label: string,
    timeZone: string
): number | null {
    const offsets = new Set([
        offsetMs(wall, timeZone),
        offsetMs(wall - DAY_MS, timeZone),
        offsetMs(wall + DAY_MS, timeZone),
    ]);
    for (const offset of offsets) {
        const instant = wall - offset;
        const date = new Date(instant);
        if (wallMs(date, timeZone) !== wall) continue;
        if (
            KNOWN_LABELS[timeZone] === label ||
            intlLabel(date, timeZone) === label
        )
            return instant;
    }
    return null;
}

function isValidZone(timeZone: string): boolean {
    try {
        clockFormat(timeZone);
        return true;
    } catch {
        return false;
    }
}

function candidateZones(label: string): string[] {
    const remembered = zoneByLabel.get(label);
    return [
        ...(remembered ? [remembered] : []),
        ...PREFERRED_ZONES,
        ...Intl.supportedValuesOf('timeZone'),
    ];
}

/**
 * 저장된 도구 결과의 시각을 ISO 순간(`toISOString`)으로 바꾼다. ISO 순간이면 그대로 정규화하고, core가 지역화한
 * `YYYY-MM-DD HH:MM <라벨>`이면 그 분의 순간으로 되돌린다. 날짜만 있는 값·시간대가 없는 값·읽을 수 없는 값은 `null`.
 */
export function parseStoredToolInstant(value: string): string | null {
    if (ISO_INSTANT_RE.test(value)) {
        const ms = Date.parse(value);
        return Number.isNaN(ms) ? null : new Date(ms).toISOString();
    }
    const match = LOCALIZED_RE.exec(value);
    if (match === null) return null;
    const [, year, month, day, hour, minute, label] = match;
    const wall = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute)
    );
    // `Date.UTC`가 넘친 값(13월·25시)을 다음 단위로 넘기므로, 되읽어 같은 숫자인지 본다.
    if (
        new Date(wall).toISOString().slice(0, 16) !==
        `${year}-${month}-${day}T${hour}:${minute}`
    )
        return null;
    const fixed = fixedOffsetMs(label);
    if (fixed !== null) return new Date(wall - fixed).toISOString();
    if (!SCANNABLE_LABEL_RE.test(label) || unmatched.has(value)) return null;
    for (const timeZone of candidateZones(label)) {
        if (!isValidZone(timeZone)) continue;
        const instant = instantIn(wall, label, timeZone);
        if (instant !== null) {
            zoneByLabel.set(label, timeZone);
            return new Date(instant).toISOString();
        }
    }
    rememberUnmatched(value);
    return null;
}

/** 저장된 시각 비교용: 지역화된 값은 분 단위라, 양쪽을 같은 분으로 내려 비교한다. */
export function toStoredMinuteMs(iso: string): number {
    return Math.floor(Date.parse(iso) / MINUTE_MS) * MINUTE_MS;
}
