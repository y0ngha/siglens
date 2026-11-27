/**
 * 분석 결과가 이미 담고 있는 상위 시간대 읽기(`higherTimeframe`)와 시장 배경(`marketBackdrop`)을 화면·복사
 * 리포트가 같이 쓰는 표시 모델로 옮긴다.
 *
 * 이 파일에는 판정·임계값·재계산이 없다 — 추세, 정렬, 진행 중 여부, 변화율은 전부 core가 계산해 결과에 붙여 둔
 * 값이다(분석 도메인은 `@y0ngha/siglens-core` 몫). 여기서는 알 수 없는 값을 걸러 내고(캐시에서 되살아난 옛 형태·
 * 부분 객체) 소수 첫째 자리로 부호를 붙이는 표시 서식만 한다. 두 필드가 모두 없는 옛 결과는 `null`을 낸다.
 */
import type {
    AnalysisResponse,
    HigherTimeframeKind,
    MarketBackdropChange,
    Trend,
    TrendAlignment,
} from '@y0ngha/siglens-core';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { TREND_LABEL_KEY } from './trendUtils';

interface HigherTimeframeContext {
    kind: HigherTimeframeKind;
    /** `null` = core가 판단하지 못한 상태(봉 부족). 보합과 다르다. */
    trend: Trend | null;
    /** 이 차트의 추세와의 관계. 추세가 `null`이면 `null`. */
    alignment: TrendAlignment | null;
    /** 마지막 봉이 아직 진행 중임을 core가 증명했을 때만 참. */
    lastBarInProgress: boolean;
}

interface MarketBackdropContext {
    label: string;
    trend: Trend | null;
    /**
     * 비교 지수 수치의 기준일(`YYYY-MM-DD`). 분석에 쓴 봉의 날짜와 **다를 때만** 채운다(같으면 카드의 기존
     * 날짜가 기준을 말해 준다). 분석 봉의 날짜를 모르면(`dataAsOf` 없음) 기준을 밝히려고 채운다.
     */
    basisDate: string | null;
    /** 20거래일 구간. 값이 둘 다 있을 때만 채운다. */
    change: {
        sessions: number;
        symbolPct: string;
        benchmarkPct: string;
    } | null;
}

export interface AnalysisContextModel {
    higherTimeframe: HigherTimeframeContext | null;
    market: MarketBackdropContext | null;
}

const KINDS: readonly HigherTimeframeKind[] = ['daily', 'weekly', 'monthly'];
const ALIGNMENTS: readonly TrendAlignment[] = ['aligned', 'opposed', 'mixed'];
const CHANGE_SESSIONS = 20;

function isTrend(value: unknown): value is Trend {
    return typeof value === 'string' && Object.hasOwn(TREND_LABEL_KEY, value);
}

function trendOrNull(value: unknown): Trend | null {
    return isTrend(value) ? value : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateOf(barTimeSec: number): string {
    return new Date(barTimeSec * 1000).toISOString().slice(0, 10);
}

/** core 날짜(`endDate`)가 실제 달력 날짜일 때만 쓴다(왕복 검사). */
function validIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
    const ms = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(ms) && isoDateOf(ms / 1000) === value;
}

function pickBasisDate(
    endDate: unknown,
    barTimeSec: number | undefined
): string | null {
    if (!validIsoDate(endDate)) return null;
    return barTimeSec !== undefined && isoDateOf(barTimeSec) === endDate
        ? null
        : endDate;
}

function pickChange(
    relative: readonly MarketBackdropChange[] | undefined
): MarketBackdropContext['change'] {
    const entry = relative?.find(item => item.sessions === CHANGE_SESSIONS);
    if (
        entry === undefined ||
        typeof entry.symbolPct !== 'number' ||
        typeof entry.benchmarkPct !== 'number'
    ) {
        return null;
    }
    return {
        sessions: entry.sessions,
        symbolPct: formatSignedPercent(entry.symbolPct),
        benchmarkPct: formatSignedPercent(entry.benchmarkPct),
    };
}

/**
 * 분석 결과의 `higherTimeframe`·`marketBackdrop`을 표시 모델로 옮긴다. 두 필드가 모두 없거나 쓸 수 없는 형태면
 * `null`(옛 결과). 알 수 없는 값은 걸러 내고 `null` 추세는 보합으로 바꾸지 않는다. `dataAsOf`는 비교 지수 기준일을
 * 말할지 가리는 데만 쓴다. 판정은 하지 않는다(core가 계산한 값을 옮길 뿐).
 */
export function buildAnalysisContextModel(
    analysis: Pick<
        AnalysisResponse,
        'higherTimeframe' | 'marketBackdrop' | 'dataAsOf'
    >
): AnalysisContextModel | null {
    const barTime = analysis.dataAsOf?.barTime;
    const htf = analysis.higherTimeframe;
    const backdrop = analysis.marketBackdrop;

    const higherTimeframe: HigherTimeframeContext | null =
        htf !== undefined && htf !== null && KINDS.includes(htf.kind)
            ? {
                  kind: htf.kind,
                  trend: trendOrNull(htf.trend),
                  alignment:
                      htf.alignment !== null &&
                      ALIGNMENTS.includes(htf.alignment)
                          ? htf.alignment
                          : null,
                  lastBarInProgress: htf.lastBarInProgress === true,
              }
            : null;
    const market: MarketBackdropContext | null =
        backdrop !== undefined &&
        backdrop !== null &&
        typeof backdrop.label === 'string' &&
        backdrop.label !== ''
            ? {
                  label: backdrop.label,
                  trend: trendOrNull(backdrop.trend),
                  basisDate: pickBasisDate(
                      backdrop.endDate,
                      typeof barTime === 'number' ? barTime : undefined
                  ),
                  change: pickChange(backdrop.relative),
              }
            : null;

    return higherTimeframe === null && market === null
        ? null
        : { higherTimeframe, market };
}

type HtfTrendKey = 'htfTrend' | 'htfAligned' | 'htfOpposed' | 'htfMixed';
type ProgressKey = 'progressDaily' | 'progressWeekly' | 'progressMonthly';

/**
 * 보여 줄 문장 한 줄. `key`가 문장(번역 키)이자 화면의 React key다(한 결과에서 줄 종류는 한 번씩만 나온다).
 * 키마다 필요한 값이 다르므로 params를 키별로 정확히 둔다.
 */
export type ContextLine =
    | {
          key: HtfTrendKey;
          params: { kind: HigherTimeframeKind; trend: Trend };
      }
    | { key: 'htfUnknown'; params: { kind: HigherTimeframeKind } }
    | { key: ProgressKey; params: Record<never, never> }
    | { key: 'marketTrend'; params: { label: string; trend: Trend } }
    | { key: 'marketUnknown'; params: { label: string } }
    /** `date`는 `YYYY-MM-DD`. */
    | { key: 'marketBasis'; params: { date: string } }
    | {
          key: 'marketChange';
          params: {
              sessions: number;
              /** 표시용 종목 코드(거래소 접미사 없음). */
              ticker: string;
              symbolPct: string;
              benchmarkPct: string;
          };
      };

export type ContextLineKey = ContextLine['key'];

const ALIGNMENT_KEY: Record<TrendAlignment, HtfTrendKey> = {
    aligned: 'htfAligned',
    opposed: 'htfOpposed',
    mixed: 'htfMixed',
};

const PROGRESS_KEY: Record<HigherTimeframeKind, ProgressKey> = {
    daily: 'progressDaily',
    weekly: 'progressWeekly',
    monthly: 'progressMonthly',
};

/**
 * 표시 모델에서 보여 줄 문장 줄을 고른다(순수). 어떤 문장을 낼지만 정하고 번역·서식은 훅이 한다.
 * 상위 시간대 줄 → (진행 중이면) 진행 중 줄 → 시장 추세 줄 → (다르면) 기준일 줄 → 20거래일 변화 줄 순이다.
 *
 * @param ticker - `marketChange`에 찍을 표시용 종목 코드(거래소 접미사 없음).
 */
export function selectContextLines(
    model: AnalysisContextModel,
    ticker: string
): ContextLine[] {
    const lines: ContextLine[] = [];
    const { higherTimeframe: htf, market } = model;
    if (htf !== null) {
        const { kind, trend } = htf;
        if (trend === null) {
            lines.push({ key: 'htfUnknown', params: { kind } });
        } else {
            const key =
                htf.alignment === null
                    ? 'htfTrend'
                    : ALIGNMENT_KEY[htf.alignment];
            lines.push({ key, params: { kind, trend } });
        }
        if (htf.lastBarInProgress) {
            lines.push({ key: PROGRESS_KEY[kind], params: {} });
        }
    }
    if (market !== null) {
        lines.push(
            market.trend === null
                ? { key: 'marketUnknown', params: { label: market.label } }
                : {
                      key: 'marketTrend',
                      params: { label: market.label, trend: market.trend },
                  }
        );
        if (market.basisDate !== null) {
            lines.push({
                key: 'marketBasis',
                params: { date: market.basisDate },
            });
        }
        if (market.change !== null) {
            lines.push({
                key: 'marketChange',
                params: {
                    sessions: market.change.sessions,
                    ticker,
                    symbolPct: market.change.symbolPct,
                    benchmarkPct: market.change.benchmarkPct,
                },
            });
        }
    }
    return lines;
}
