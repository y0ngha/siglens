import { isPlainRecord } from '@/shared/lib/isPlainRecord';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import type {
    ChatBlock,
    ChatChartBlock,
    ChatChartTimeframe,
    ChatCompareChartPeriod,
    ChatVisualBlock,
    ChatVisualBlockKind,
} from '../types';

// 값 목록을 core에서 가져오지 않는다 — 클라이언트(채팅 화면)가 이 파일을 값으로 쓰므로, core를 값으로 import하면 core
// 번들 전체가 실린다. 두 목록이 core·레지스트리와 같은지는 테스트(`chartBlock.test.ts`)가 확인한다.

/** core `AGENT_BARS_TIMEFRAMES`와 같은 목록. */
export const CHAT_CHART_TIMEFRAMES: readonly ChatChartTimeframe[] = [
    '5Min',
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
    '1Day',
    '1Week',
    '1Month',
];

/** 시장 프로필 레지스트리의 id 목록. */
export const CHAT_CHART_MARKET_PROFILES: readonly MarketProfileId[] = [
    'us-equity',
    'crypto',
    'kr-equity',
];

const isOneOf = <T extends string>(
    list: readonly T[],
    value: unknown
): value is T => list.some(item => item === value);

/**
 * 저장된 행·SSE 프레임에서 읽은 값이 그릴 수 있는 차트 블록인지 — 모양과 함께 주기·시장이 아는 값인지도 본다(이름이
 * 바뀐 뒤 읽힌 옛 행이 모르는 값으로 차트에 가지 않게). 아니면 그리지 않는다.
 */
export function isChatChartBlock(value: unknown): value is ChatChartBlock {
    if (typeof value !== 'object' || value === null) return false;
    // 바로 위에서 null 아닌 객체임을 확인했다 — 필드를 하나씩 검사하려고 키로 읽을 수 있는 모양으로 본다.
    const v = value as Record<string, unknown>;
    return (
        v.version === 1 &&
        typeof v.symbol === 'string' &&
        isOneOf(CHAT_CHART_TIMEFRAMES, v.timeframe) &&
        isOneOf(CHAT_CHART_MARKET_PROFILES, v.marketProfile) &&
        Array.isArray(v.bars) &&
        v.bars.length > 0 &&
        Array.isArray(v.overlays) &&
        typeof v.overlayColors === 'object' &&
        v.overlayColors !== null &&
        typeof v.overlayLabels === 'object' &&
        v.overlayLabels !== null
    );
}

/** core `AGENT_CHART_KINDS`와 같은 목록. */
export const CHAT_VISUAL_BLOCK_KINDS: readonly ChatVisualBlockKind[] = [
    'compare',
    'financials',
    'options',
    'flows',
    'portfolio',
    'heatmap',
    'dividends',
];

/** core `AGENT_CHART_PERIODS`와 같은 목록. */
export const CHAT_COMPARE_PERIODS: readonly ChatCompareChartPeriod[] = [
    '1M',
    '3M',
    '6M',
    '1Y',
];

type Rec = Record<string, unknown>;

const isNum = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isNumOrNull = (value: unknown): boolean => value === null || isNum(value);

const isStrOrNull = (value: unknown): boolean =>
    value === null || typeof value === 'string';

/** 배열이고 비어 있지 않으며 모든 원소가 `check`를 통과한다. */
const isNonEmptyListOf = (
    value: unknown,
    check: (item: unknown) => boolean
): boolean => Array.isArray(value) && value.length > 0 && value.every(check);

const FIELD_CHECKS: Record<ChatVisualBlockKind, (v: Rec) => boolean> = {
    compare: v =>
        isOneOf(CHAT_COMPARE_PERIODS, v.period) &&
        isNonEmptyListOf(
            v.series,
            s =>
                isPlainRecord(s) &&
                typeof s.symbol === 'string' &&
                isNonEmptyListOf(
                    s.points,
                    p =>
                        Array.isArray(p) &&
                        p.length === 2 &&
                        isNum(p[0]) &&
                        isNum(p[1])
                )
        ),
    financials: v =>
        typeof v.symbol === 'string' &&
        typeof v.currency === 'string' &&
        isNonEmptyListOf(
            v.quarters,
            q =>
                isPlainRecord(q) &&
                typeof q.period === 'string' &&
                isNumOrNull(q.revenue) &&
                isNumOrNull(q.netIncome) &&
                isNumOrNull(q.eps) &&
                isNumOrNull(q.epsActual) &&
                isNumOrNull(q.epsEstimated)
        ),
    options: v =>
        typeof v.symbol === 'string' &&
        typeof v.expiry === 'string' &&
        isNum(v.underlyingPrice) &&
        isNumOrNull(v.maxPain) &&
        isNumOrNull(v.putCallRatio) &&
        isNonEmptyListOf(
            v.strikes,
            r =>
                isPlainRecord(r) &&
                isNum(r.strike) &&
                isNum(r.callOI) &&
                isNum(r.putOI)
        ),
    flows: v => {
        if (typeof v.symbol !== 'string') return false;
        if (v.market === 'kr')
            return isNonEmptyListOf(
                v.days,
                d =>
                    isPlainRecord(d) &&
                    typeof d.date === 'string' &&
                    isNum(d.foreign) &&
                    isNum(d.institution) &&
                    isNumOrNull(d.individual)
            );
        if (v.market !== 'us') return false;
        const institutionalOk =
            Array.isArray(v.institutional) &&
            v.institutional.every(
                q =>
                    isPlainRecord(q) &&
                    typeof q.period === 'string' &&
                    // `complete`가 생기기 전에 저장된 블록은 이 필드가 없다 — 완결 분기로 읽는다.
                    (q.complete === undefined ||
                        typeof q.complete === 'boolean') &&
                    isNum(q.holders) &&
                    isNum(q.netShareChange)
            );
        const insiderOk =
            Array.isArray(v.insiderNetValue) &&
            v.insiderNetValue.every(
                m =>
                    isPlainRecord(m) &&
                    typeof m.month === 'string' &&
                    isNum(m.value)
            );
        return (
            institutionalOk &&
            insiderOk &&
            (v.institutional as unknown[]).length +
                (v.insiderNetValue as unknown[]).length >
                0
        );
    },
    portfolio: v =>
        isNonEmptyListOf(
            v.groups,
            g =>
                isPlainRecord(g) &&
                typeof g.currency === 'string' &&
                isNonEmptyListOf(
                    g.holdings,
                    h =>
                        isPlainRecord(h) &&
                        typeof h.symbol === 'string' &&
                        isStrOrNull(h.name) &&
                        isNumOrNull(h.weightPct) &&
                        isNumOrNull(h.pnlPct)
                )
        ),
    heatmap: v => {
        if (v.scope === 'sectors')
            return (
                (v.market === 'us' || v.market === 'kr') &&
                isNonEmptyListOf(
                    v.sectors,
                    s =>
                        isPlainRecord(s) &&
                        typeof s.label === 'string' &&
                        isNum(s.changePct)
                )
            );
        return (
            v.scope === 'theme' &&
            typeof v.theme === 'string' &&
            typeof v.label === 'string' &&
            isNonEmptyListOf(
                v.members,
                m =>
                    isPlainRecord(m) &&
                    typeof m.symbol === 'string' &&
                    isStrOrNull(m.name) &&
                    isNumOrNull(m.changePct1d) &&
                    isNumOrNull(m.changePct5d) &&
                    isNumOrNull(m.changePct20d)
            )
        );
    },
    dividends: v =>
        typeof v.symbol === 'string' &&
        typeof v.currency === 'string' &&
        isNonEmptyListOf(
            v.years,
            y =>
                isPlainRecord(y) &&
                isNum(y.year) &&
                isNum(y.amount) &&
                typeof y.partial === 'boolean'
        ),
};

/**
 * 저장된 행·SSE 프레임에서 읽은 값이 그릴 수 있는 시각화 블록인지 — `kind`·`version`을 알고 그 kind의 필드가 맞을
 * 때만 참이다(모르는 kind·버전은 그리지 않는다).
 */
export function isChatVisualBlock(value: unknown): value is ChatVisualBlock {
    if (!isPlainRecord(value) || value.version !== 1) return false;
    const { kind, name } = value;
    return (
        (name === undefined || name === null || typeof name === 'string') &&
        isOneOf(CHAT_VISUAL_BLOCK_KINDS, kind) &&
        FIELD_CHECKS[kind](value)
    );
}

/** 캔들 차트 블록은 `kind`가 없다 — `kind`가 있으면 시각화 블록이다. */
export function isVisualBlock(block: ChatBlock): block is ChatVisualBlock {
    return 'kind' in block;
}

/** 그릴 수 있는 블록(캔들 차트 또는 시각화)인지. 옛 캔들 행은 그대로 통과한다. */
export function isChatBlock(value: unknown): value is ChatBlock {
    return isPlainRecord(value) && 'kind' in value
        ? isChatVisualBlock(value)
        : isChatChartBlock(value);
}
