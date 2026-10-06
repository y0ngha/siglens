import {
    isRegularSessionOpen,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    lastClosedSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import { MS_PER_SECOND, SECONDS_PER_DAY } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * 가격이 **언제 기준인지**를 사람이 읽는 짧은 문구로 만든다.
 *
 * 평이화 산출물은 만들어진 뒤 며칠씩 저장·색인된다(`analysis_plain_texts`는 만료가 없고
 * 허브·종목 페이지는 ISR로 굳는다). 그런데 프롬프트가 "지금 주가"를 밝히라고 해서 글이
 * "지금 329.4달러"로 시작했고, 읽는 시점과 무관하게 그 문장이 남았다 — 읽는 사람에게
 * "지금"은 읽는 순간인데 값은 며칠 전이다. 그래서 가격 앞에는 읽는 시점에 기대는 말
 * 대신 **값이 정해진 날짜**를 붙이고, 그 날짜를 이 함수가 만든다.
 *
 * - 정규장이 열려 있으면 그날의 장중 값이다 — `9월 29일 장중`.
 * - 닫혀 있으면(장 마감 후·주말·휴장일) 직전 마감 세션의 종가다 — `9월 26일 종가`.
 *   날짜는 **시장 현지 달력**이다. 한국 종목이 미국 달력으로 되감기면 하루가 어긋난다.
 * - 24시간 시장(크립토)은 마감이 없어 UTC 날짜만 쓴다 — `10월 5일 UTC`.
 *
 * 문구는 모델에게 보내는 값이라 i18n 카탈로그를 거치지 않는다(`analysis-plain/lib/`는
 * 추출 제외 — `collectFacts`의 통화 표기와 같다). 영어 월 이름은 `Intl` 대신 고정 표로
 * 둔다 — ICU 빌드마다 표기가 갈린 전례가 있고, 이 값은 숫자 가드의 입력이기도 하다.
 */
type PriceAsOfKind = 'intraday' | 'close' | 'utc';

interface AsOfFormat {
    readonly format: (month: number, day: number) => string;
    readonly suffix: Record<PriceAsOfKind, string>;
}

const EN_MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
] as const;

const KO: AsOfFormat = {
    format: (m, d) => `${m}월 ${d}일`,
    suffix: { intraday: '장중', close: '종가', utc: 'UTC' },
};

const AS_OF_FORMAT: Record<string, AsOfFormat> = {
    ko: KO,
    en: {
        format: (m, d) => `${EN_MONTHS[m - 1]} ${d}`,
        suffix: { intraday: 'intraday', close: 'close', utc: 'UTC' },
    },
    ja: {
        format: (m, d) => `${m}月${d}日`,
        suffix: { intraday: '場中', close: '終値', utc: 'UTC' },
    },
    zh: {
        format: (m, d) => `${m}月${d}日`,
        suffix: { intraday: '盘中', close: '收盘价', utc: 'UTC' },
    },
};

/** `YYYY-MM-DD` → `[월, 일]`. */
function monthAndDay(isoDate: string): [number, number] {
    const [, month, day] = isoDate.split('-');
    return [Number(month), Number(day)];
}

function formatAsOf(
    isoDate: string,
    kind: PriceAsOfKind,
    locale: string
): string {
    const format = AS_OF_FORMAT[locale] ?? KO;
    const [month, day] = monthAndDay(isoDate);
    return `${format.format(month, day)} ${format.suffix[kind]}`;
}

/**
 * @param spec 심볼이 속한 시장의 세션 스펙(`sessionSpecFor`). 호출자가 시장 프로필에서 고른다 —
 *   크립토는 심볼 형상만으로 알 수 없어(`crypto_assets` DB 멤버십) 여기서 추측하지 않는다.
 * @param now 기준 시각. 호출자가 주입한다(테스트가 시계를 고정할 수 있게).
 * @param locale 출력 언어. 모르는 값은 한국어로 떨어진다.
 */
export function buildPriceAsOf(
    spec: MarketSessionSpec,
    now: Date,
    locale: string
): string {
    if (spec.kind === 'always-open') {
        return formatAsOf(toUtcIsoDate(now), 'utc', locale);
    }
    if (isRegularSessionOpen(spec, now)) {
        return formatAsOf(zonedDate(now, spec.timeZone), 'intraday', locale);
    }
    // 버퍼 0 — "마감이 지난 순간부터" 그날 종가다. 기본 버퍼(4시간)는 EOD 발행 대기용이라
    // 여기서는 오히려 마감 직후 몇 시간 동안 하루 전 날짜를 잘못 말하게 만든다.
    return formatAsOf(lastClosedSessionDate(spec, now, 0), 'close', locale);
}

/** ISO 문자열을 `Date`로. 문자열이 아니거나 해석할 수 없으면 `null`. */
function parseInstant(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 분석이 실제로 쓴 **마지막 봉**(core `AnalysisResponse.dataAsOf.barTime`)에서 기준 시점을 만든다.
 *
 * `buildPriceAsOf`는 "지금 시장이 어떤 상태인가"로 날짜를 고르는데, 분석은 세션이 끝나기 전에
 * 만들어져 마감 뒤에 재사용될 수 있다 — 그러면 글의 가격은 옛 봉 값인데 기준일만 최신이 된다.
 * 분석이 스스로 밝힌 봉 시각이 있으면 그쪽이 더 정확하다.
 *
 * - 크립토(24시간): 봉 시각의 UTC 날짜 — `10월 5일 UTC`.
 * - 일봉(`barTime`이 UTC 자정 — core는 일봉 시각을 UTC 자정 초로 둔다): 그 날짜. **분석을
 *   만든 시점**(`analyzedAt`)에 그날 세션이 이미 마감됐으면 `종가`, 아니면 `장중`이다 —
 *   세션 도중에 만든 분석의 일봉 값은 형성 중인 값이고, 마감 뒤에 재사용돼도 종가가 아니다.
 *   `analyzedAt`을 모르면(옛 캐시 항목) 지금 시각으로 판정한다.
 * - 그 밖의 분·시간봉: 시장 현지 달력의 봉 날짜 + `장중`. 정규장이 이미 끝났어도 그 값은
 *   그날 장중 시각의 값이라 `종가`로 부르면 틀린다.
 *
 * 유한한 숫자가 아니면 `null` — 호출자가 `buildPriceAsOf`로 물러난다.
 */
export function buildDataAsOfLabel(
    spec: MarketSessionSpec,
    barTimeSec: unknown,
    now: Date,
    locale: string,
    analyzedAt?: unknown
): string | null {
    if (typeof barTimeSec !== 'number' || !Number.isFinite(barTimeSec)) {
        return null;
    }
    const barDate = new Date(barTimeSec * MS_PER_SECOND);
    if (Number.isNaN(barDate.getTime())) return null;

    if (spec.kind === 'always-open') {
        return formatAsOf(toUtcIsoDate(barDate), 'utc', locale);
    }
    const isDailyBar = barTimeSec % SECONDS_PER_DAY === 0;
    if (!isDailyBar) {
        return formatAsOf(
            zonedDate(barDate, spec.timeZone),
            'intraday',
            locale
        );
    }
    const date = toUtcIsoDate(barDate);
    const madeAt = parseInstant(analyzedAt) ?? now;
    // ISO 날짜(YYYY-MM-DD)는 사전순이 곧 날짜순이다.
    const closed = date <= lastClosedSessionDate(spec, madeAt, 0);
    return formatAsOf(date, closed ? 'close' : 'intraday', locale);
}
