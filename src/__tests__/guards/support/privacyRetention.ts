import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { LOCALES, type Locale } from '@/shared/i18n/locales';

/**
 * `privacyRetention.test.ts`가 쓰는 **순수 탐지기**. 방침 본문(로케일별 마크다운)과 레지스트리(코드 상수에서 온
 * 값)를 받아 위반 문장 배열을 돌려준다. 파일·상수를 읽지 않으므로 테스트가 변형한 사본을 같은 검사에 넣어
 * 반증할 수 있다. 레지스트리 데이터(어느 상수를 어느 줄에 묶는가)는 테스트 쪽에 둔다.
 */

export type Policies = Readonly<Record<Locale, string>>;

export type Unit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export type Section = 2 | 4 | 6 | 7;

export interface Token {
    readonly value: number;
    readonly unit: Unit;
}

export interface Place {
    readonly section: Section;
    /** 한국어 원문의 해당 절에서 이 문구를 담은 불릿이 정확히 하나여야 한다. */
    readonly marker: string;
    /**
     * 있으면 줄에서 이 문구가 **마지막으로** 나온 곳부터 끝까지만 본다. 한 줄에 여러 흐름의 시간이 섞인
     * 줄(Upstash 위탁)에서 다른 흐름의 같은 숫자로 통과하지 않게 한다.
     */
    readonly scopeAfter?: Readonly<Record<Locale, string>>;
    /** `scopeAfter` 뒤에서 이 문구가 처음 나오는 곳 앞까지로 끝을 자른다(다음 흐름의 같은 숫자 배제). */
    readonly scopeUntil?: Readonly<Record<Locale, string>>;
}

export interface Entry {
    readonly id: string;
    /** 코드 상수에서 온 초. 값 자체를 테스트 파일에 적지 않는다. */
    readonly seconds: number;
    /** 방침이 쓰는 단위. `seconds`가 이 단위의 정수배여야 한다. */
    readonly unit: Unit;
    readonly places: readonly Place[];
}

export interface Unbacked extends Token {
    readonly section: 4;
    readonly marker: string;
    readonly reason: string;
}

export const UNIT_SECONDS: Record<Unit, number> = {
    second: 1,
    minute: 60,
    hour: SECONDS_PER_HOUR,
    day: SECONDS_PER_DAY,
    month: SECONDS_PER_DAY * 30,
    year: SECONDS_PER_DAY * 365,
};

const UNITS = Object.keys(UNIT_SECONDS) as Unit[];

/** 로케일별 단위 표기(정규식 조각). 숫자와 단위 사이 공백은 en만 필수다. */
const UNIT_PATTERN: Record<Locale, Record<Unit, string>> = {
    ko: {
        second: '초',
        minute: '분',
        hour: '시간',
        day: '일',
        month: '개월',
        year: '년',
    },
    en: {
        second: 'seconds?\\b',
        minute: 'minutes?\\b',
        hour: 'hours?\\b',
        day: 'days?\\b',
        month: 'months?\\b',
        year: 'years?\\b',
    },
    ja: {
        second: '秒',
        minute: '分間?',
        hour: '時間',
        day: '日(?!の)',
        month: '[かヶケ]月',
        year: '年',
    },
    zh: {
        second: '秒',
        minute: '分钟',
        hour: '小时',
        day: '天',
        month: '个月',
        year: '年',
    },
};

const SEPARATOR: Record<Locale, string> = {
    ko: '\\s?',
    en: '\\s',
    ja: '\\s?',
    zh: '\\s?',
};

const SECTIONS: readonly Section[] = [2, 4, 6, 7];

/** `## n.` 제목부터 다음 `## ` 제목 앞까지의 불릿(`- ` 로 시작하는 줄). */
export function bulletsOf(policy: string, section: number): string[] {
    const lines = policy.split('\n');
    const start = lines.findIndex(line => line.startsWith(`## ${section}.`));
    if (start === -1) return [];
    const rest = lines.slice(start + 1);
    const end = rest.findIndex(line => line.startsWith('## '));
    return (end === -1 ? rest : rest.slice(0, end)).filter(line =>
        line.startsWith('- ')
    );
}

function phraseRegex(locale: Locale, value: number, unit: Unit): RegExp {
    return new RegExp(
        `(?<![\\d.:])${value}${SEPARATOR[locale]}${UNIT_PATTERN[locale][unit]}`
    );
}

/** 줄에서 "숫자+시간 단위"를 모두 뽑는다. */
export function extractTokens(locale: Locale, line: string): Token[] {
    return UNITS.flatMap(unit => {
        const re = new RegExp(
            `(?<![\\d.:])(\\d+)${SEPARATOR[locale]}${UNIT_PATTERN[locale][unit]}`,
            'g'
        );
        return [...line.matchAll(re)].map(match => ({
            value: Number(match[1]),
            unit,
        }));
    });
}

function koIndex(
    policies: Policies,
    section: Section,
    marker: string
): number | string {
    const hits = bulletsOf(policies.ko, section).flatMap((line, index) =>
        line.includes(marker) ? [index] : []
    );
    if (hits.length === 1 && hits[0] !== undefined) return hits[0];
    return `한국어 §${section}에서 "${marker}"를 담은 불릿이 ${hits.length}개다(정확히 1개여야 한다)`;
}

function lineAt(
    policies: Policies,
    locale: Locale,
    section: Section,
    index: number
): string {
    return bulletsOf(policies[locale], section)[index] ?? '';
}

/** 레지스트리 항목의 방침 표기 값. 단위의 양의 정수배가 아니면 `undefined`. */
function valueOf(entry: Entry): number | undefined {
    const value = entry.seconds / UNIT_SECONDS[entry.unit];
    return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** 한국어 §4 줄 인덱스에 묶인 (값, 단위). */
interface Located extends Token {
    readonly index: number;
}

const hasToken = (located: readonly Located[], index: number, t: Token) =>
    located.some(
        l => l.index === index && l.value === t.value && l.unit === t.unit
    );

/** 레지스트리가 §4에서 덮는 숫자. 단위가 안 맞거나 줄을 못 찾는 항목은 정방향이 따로 보고한다. */
function coveredTokens(
    policies: Policies,
    entries: readonly Entry[]
): Located[] {
    return entries.flatMap(entry => {
        const value = valueOf(entry);
        if (value === undefined) return [];
        return entry.places
            .filter(place => place.section === 4)
            .flatMap(place => {
                const index = koIndex(policies, place.section, place.marker);
                return typeof index === 'number'
                    ? [{ index, value, unit: entry.unit }]
                    : [];
            });
    });
}

/** 허용 목록이 §4에서 허용하는 숫자. 줄을 못 찾는 항목은 허용 검사가 따로 보고한다. */
function allowedTokens(
    policies: Policies,
    unbacked: readonly Unbacked[]
): Located[] {
    return unbacked.flatMap(item => {
        const index = koIndex(policies, item.section, item.marker);
        return typeof index === 'number'
            ? [{ index, value: item.value, unit: item.unit }]
            : [];
    });
}

function sectionCountIssues(policies: Policies): string[] {
    return SECTIONS.flatMap(section => {
        const counts = LOCALES.map(
            locale => bulletsOf(policies[locale], section).length
        );
        return new Set(counts).size !== 1 || counts[0] === 0
            ? [
                  `§${section} 불릿 수가 로케일마다 다르다(${LOCALES.map((l, i) => `${l}=${counts[i]}`).join(', ')}). 번역본은 같은 순서·같은 개수여야 한다.`,
              ]
            : [];
    });
}

function placeLocaleIssues(
    policies: Policies,
    entry: Entry,
    value: number,
    place: Place,
    index: number,
    locale: Locale
): string[] {
    const full = lineAt(policies, locale, place.section, index);
    const scope = place.scopeAfter?.[locale];
    const cut = scope === undefined ? 0 : full.lastIndexOf(scope);
    const until = place.scopeUntil?.[locale];
    const stop =
        cut === -1 || until === undefined
            ? -1
            : full.indexOf(until, cut + (scope?.length ?? 0));
    const line =
        cut === -1 ? '' : full.slice(cut, stop === -1 ? undefined : stop);
    if (cut !== -1 && until !== undefined && stop === -1) {
        return [
            `${entry.id}: ${locale} §${place.section} "${place.marker}" 줄에서 scopeUntil 문구 "${until}"를 못 찾음. 문장이 바뀌었으면 레지스트리의 끝 문구를 고친다.`,
        ];
    }
    return phraseRegex(locale, value, entry.unit).test(line)
        ? []
        : [
              `${entry.id}: ${locale} §${place.section} "${place.marker}" 줄에 ${value} ${entry.unit}(코드 ${entry.seconds}초)이 없다. 방침 줄: ${line.slice(0, 120) || '(줄/범위를 못 찾음)'}`,
          ];
}

/** 정방향: 항목마다, 자리마다, 로케일마다 코드 값이 줄에 적혀 있어야 한다. */
function forwardIssues(
    policies: Policies,
    entries: readonly Entry[]
): string[] {
    return entries.flatMap(entry => {
        const value = valueOf(entry);
        if (value === undefined) {
            return [
                `${entry.id}: 코드 값 ${entry.seconds}초가 ${entry.unit} 단위의 양의 정수배가 아니다. 단위를 고르거나 방침 표기를 확인한다.`,
            ];
        }
        return entry.places.flatMap(place => {
            const index = koIndex(policies, place.section, place.marker);
            return typeof index === 'string'
                ? [`${entry.id}: ${index}`]
                : LOCALES.flatMap(locale =>
                      placeLocaleIssues(
                          policies,
                          entry,
                          value,
                          place,
                          index,
                          locale
                      )
                  );
        });
    });
}

/** 허용 목록: 줄이 있어야 하고, 레지스트리와 중복이 없고, 사유가 있고, 한국어 줄에 숫자가 아직 있어야 한다. */
function allowListIssues(
    policies: Policies,
    unbacked: readonly Unbacked[],
    covered: readonly Located[]
): string[] {
    return unbacked.flatMap(item => {
        const index = koIndex(policies, item.section, item.marker);
        if (typeof index === 'string') {
            return [`허용 목록 "${item.marker}": ${index}`];
        }
        const duplicated = hasToken(covered, index, item)
            ? [
                  `허용 목록 "${item.marker}" ${item.value} ${item.unit}은 레지스트리가 이미 덮는다. 허용 항목을 지운다.`,
              ]
            : [];
        const noReason =
            item.reason.trim() === ''
                ? [`허용 목록 "${item.marker}": 사유가 비어 있다.`]
                : [];
        return [...duplicated, ...noReason];
    });
}

function staleAllowIssues(
    policies: Policies,
    unbacked: readonly Unbacked[]
): string[] {
    return unbacked.flatMap(item => {
        const index = koIndex(policies, item.section, item.marker);
        if (typeof index === 'string') return [];
        const present = extractTokens(
            'ko',
            lineAt(policies, 'ko', item.section, index)
        ).some(t => t.value === item.value && t.unit === item.unit);
        return present
            ? []
            : [
                  `허용 목록 "${item.marker}" ${item.value} ${item.unit}이 한국어 줄에 더는 없다(낡은 항목). 허용 항목을 지운다.`,
              ];
    });
}

/** 역방향: §4의 모든 숫자는 레지스트리가 덮거나 허용 목록에 있어야 한다. */
function unregisteredIssues(
    policies: Policies,
    known: readonly Located[]
): string[] {
    return LOCALES.flatMap(locale =>
        bulletsOf(policies[locale], 4).flatMap((line, index) =>
            extractTokens(locale, line)
                .filter(token => !hasToken(known, index, token))
                .map(
                    token =>
                        `미등록 보관 숫자: ${locale} §4 "${token.value} ${token.unit}" — ${line.slice(0, 100)} … 코드 상수를 ENTRIES에 묶거나 사유와 함께 UNBACKED_NUMBERS에 올린다.`
                )
        )
    );
}

/**
 * 정방향·역방향 위반을 모두 모아 사람이 읽을 문장으로 돌려준다. 빈 배열이면 통과다.
 */
export function findIssues(
    policies: Policies,
    entries: readonly Entry[],
    unbacked: readonly Unbacked[]
): string[] {
    const covered = coveredTokens(policies, entries);
    const known = [...covered, ...allowedTokens(policies, unbacked)];
    return [
        ...sectionCountIssues(policies),
        ...forwardIssues(policies, entries),
        ...allowListIssues(policies, unbacked, covered),
        ...unregisteredIssues(policies, known),
        ...staleAllowIssues(policies, unbacked),
    ];
}
