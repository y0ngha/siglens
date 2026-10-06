import type {
    FearGreedFactor,
    FearGreedGroupName,
    FearGreedHistoryPoint,
    FearGreedLabel,
    FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import {
    computeLabelTransitions,
    computeMarketScoreGap,
    POC_WINDOW_DEFAULT,
    summarizeExtremeZoneEpisodes,
    type ExtremeFearGreedZone,
    type FearGreedReading,
} from '@y0ngha/siglens-core';
import {
    formatFactorRaw,
    sentimentLabelText,
} from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { koWithParticle } from '@/shared/lib/koParticle';
import type { Locale } from '@/shared/i18n/locales';
import type { SeoTranslator } from '@/shared/lib/seo';

// 5-factor percentile을 낮음/보통/높음 3구간으로 나누는 경계값. FearGreedGroupBar의
// "극단" 배지 임계값(<10 / >=90)보다 넓게 잡아, 문장 서사에서는 "평소 범위 밖"을
// 조금 더 자주 언급하도록 한다(크롤 텍스트는 정보 밀도가 UI 배지보다 중요).
const LOW_PERCENTILE_MAX = 25;
const HIGH_PERCENTILE_MIN = 75;
// factor/group 점수 percentile 척도의 중앙값. "평소 수준"에서 얼마나 벗어났는지
// 판단하는 기준점으로 findMostExtremeFactor·buildFearGreedFactorRankingLine이 공유한다.
const MEDIAN_PERCENTILE = 50;

// `t`/`tFacts`는 `views.symbol.fearGreedFacts` 네임스페이스 번역자(`SeoTranslator` 모양).
//
// 이 모듈은 SSR 크롤 텍스트를 만든다 — JS 없이 읽히는 본문이라, 여기 남은
// 한국어는 비-ko 페이지에서 그대로 색인된다. 순수 함수를 유지하려고 훅을
// 부르지 않고 번역자를 인자로 받는다(호출부는 컴포넌트 하나뿐).

/** 평소 범위(25~75 퍼센타일) 기준 위치. */
type FactorLevel = 'high' | 'mid' | 'low';

function factorLevel(pctile: number): FactorLevel {
    if (pctile < LOW_PERCENTILE_MAX) return 'low';
    if (pctile >= HIGH_PERCENTILE_MIN) return 'high';
    return 'mid';
}

/** 지표 표의 한 행. */
export interface FearGreedFactorRow {
    readonly label: string;
    /** 로케일 서식이 적용된 현재 값. */
    readonly value: string;
    /** 반올림한 0~100 퍼센타일. */
    readonly percentile: number;
}

/** 지표 표 + 평소 범위(25~75 퍼센타일)를 벗어난 지표. */
export interface FearGreedFactorTable {
    readonly rows: readonly FearGreedFactorRow[];
    /** 평소 범위 밖 지표 — 표 순서(Flow → Trend)를 따른다. */
    readonly outliers: readonly {
        readonly label: string;
        readonly level: 'high' | 'low';
    }[];
}

/**
 * snapshot의 5-factor(Flow 3개 + Trend 2개)를 **표 하나**의 행으로 만든다.
 *
 * 예전에는 지표마다 `라벨: 값 (N번째 퍼센타일) — 평소 범위…` 한 줄씩 5줄이었다. 줄마다
 * 같은 해석 문구가 반복돼 종목 간 공통 문장 비율을 끌어올렸다. 이제 기준은 표 캡션에
 * 한 번만 적고, 해석은 평소 범위(25~75 퍼센타일)를 벗어난 지표에만 붙인다.
 * 순수 함수 — 시간/난수 의존 없음.
 */
export function buildFearGreedFactorTable(
    snapshot: FearGreedSnapshot,
    // 팩터 라벨은 `shared.lib.fearGreedFactor`에 있다 — 위젯(`FearGreedGroupBar`)과
    // 공유하는 표라 이 뷰 네임스페이스로 옮기면 두 벌이 된다.
    tFactor: SeoTranslator,
    locale: Locale
): FearGreedFactorTable {
    const factors = snapshot.groups.flatMap(group => group.factors);
    const rows = factors.map((factor): FearGreedFactorRow => ({
        label: tFactor(`symbolLabel.${factor.key}`, {
            v0: POC_WINDOW_DEFAULT,
        }),
        value: formatFactorRaw(factor.key, factor.rawValue, locale),
        percentile: Math.round(factor.percentile),
    }));
    // 해석 대상은 평소 범위(25~75 퍼센타일) 밖 지표뿐이다. 행과 같은 순서(Flow → Trend).
    const outliers = rows.flatMap(row => {
        const level = factorLevel(row.percentile);
        return level === 'mid' ? [] : [{ label: row.label, level }];
    });
    return { rows, outliers };
}

/** `views.symbol.fearGreedFacts` 기준 상대 키. */
const GROUP_LABEL: Record<FearGreedGroupName, string> = {
    Flow: 'groupFlow',
    Trend: 'groupTrend',
};

/**
 * Flow/Trend 두 그룹 점수를 비교하는 심볼별 서사 문장을 만든다(audit fix
 * FIX 6, option b). 기존 factor 줄(지금은 `buildFearGreedFactorTable`)은 factor 5개 각각을
 * 3가지 고정 해석 문구 중 하나로만 서술해(low/mid/high) unique:boilerplate
 * 비율이 낮았다(~45자 unique vs ~270자 boilerplate) — 이는 2026-07 노출
 * 붕괴를 촉발한 thin-content와 구조적으로 동일하다. `snapshot.groups`에
 * 이미 계산되어 있는 그룹별 점수를 이용해, 어느 그룹이 우세한지(숫자
 * 치환이 아니라 어느 그룹명이 주어로 오는지 자체가 심볼마다 달라지는)
 * 문장을 생성한다.
 *
 * 두 그룹 모두 없으면(방어적) `null`을 반환한다 — `FearGreedSnapshot.groups`는
 * 항상 Flow/Trend 둘 다 채워지지만, 호출부가 malformed 입력을 방어 없이
 * 넘기지 않도록 명시적으로 좁힌다.
 */
export function buildFearGreedGroupComparisonLine(
    snapshot: FearGreedSnapshot,
    t: SeoTranslator
): string | null {
    const flow = snapshot.groups.find(g => g.name === 'Flow');
    const trend = snapshot.groups.find(g => g.name === 'Trend');
    if (!flow || !trend) return null;

    const flowScore = Math.round(flow.score);
    const trendScore = Math.round(trend.score);

    if (flowScore === trendScore) {
        return t('groupBalanced', {
            v0: t(GROUP_LABEL.Flow),
            v1: t(GROUP_LABEL.Trend),
            v2: flowScore,
        });
    }

    const leader = flowScore > trendScore ? flow : trend;
    const lagging = flowScore > trendScore ? trend : flow;
    const leaderScore = Math.round(leader.score);
    const laggingScore = Math.round(lagging.score);
    const gap = leaderScore - laggingScore;

    return t('groupLead', {
        v0: t(GROUP_LABEL[leader.name]),
        v1: leaderScore,
        v2: t(GROUP_LABEL[lagging.name]),
        v3: laggingScore,
        v4: gap,
    });
}

/** MEDIAN_PERCENTILE(중앙값)에서 가장 멀리 떨어진(=가장 두드러진) factor를 고른다. 동률이면 원 순서(Flow → Trend) 중 먼저 나온 쪽을 유지한다(Array.sort는 stable). */
function findMostExtremeFactor(
    factors: readonly FearGreedFactor[]
): FearGreedFactor | null {
    if (factors.length === 0) return null;
    return factors.toSorted(
        (a, b) =>
            Math.abs(b.percentile - MEDIAN_PERCENTILE) -
            Math.abs(a.percentile - MEDIAN_PERCENTILE)
    )[0]!;
}

/**
 * 5개 factor 중 50번째 퍼센타일(평소 수준)에서 가장 멀리 벗어난 — 즉 가장
 * 두드러진 — factor를 지목하는 심볼별 서사 문장을 만든다(audit fix FIX 6,
 * option b). 어느 factor가 뽑히는지 자체가 심볼마다 달라지므로 숫자 치환을
 * 넘어 문장 구조(주어)가 달라진다. factor가 하나도 없으면 `null`.
 */
export function buildFearGreedFactorRankingLine(
    snapshot: FearGreedSnapshot,
    t: SeoTranslator,
    tFactor: SeoTranslator
): string | null {
    const allFactors = snapshot.groups.flatMap(g => g.factors);
    const top = findMostExtremeFactor(allFactors);
    if (top === null) return null;

    const pctile = Math.round(top.percentile);
    const direction =
        pctile >= MEDIAN_PERCENTILE ? t('directionHigh') : t('directionLow');

    return t('topFactor', {
        v0: allFactors.length,
        v1: tFactor(`symbolLabel.${top.key}`, { v0: POC_WINDOW_DEFAULT }),
        v2: pctile,
        v3: direction,
    });
}

/**
 * `computeFearGreedHistory`가 돌려준 시계열에서 warm-up(`score === null`)을 걷어낸다.
 * 아래 시계열 문장 3종이 공유하는 전처리다.
 */
export type ScoredPoint = {
    date: string;
    score: number;
    label: FearGreedLabel;
};

export function scoredHistory(
    history: readonly FearGreedHistoryPoint[]
): ScoredPoint[] {
    return history.flatMap(p =>
        p.score === null || p.label === null
            ? []
            : [{ date: p.date, score: p.score, label: p.label }]
    );
}

/**
 * `2026-08-19` → `2026년 8월 19일`. `Date`를 거치지 않아 타임존 이동이 없다.
 *
 * core의 `FearGreedHistoryPoint.date`는 계약상 `YYYY-MM-DD`지만, 전체 ISO 타임스탬프가
 * 들어오면 `split('-')[2]`가 `19T00:00:00Z`가 되어 `2026년 8월 NaN일`을 뱉는다.
 * 존재 검사만으로는 안 잡히므로 숫자 검사까지 한다 — 실패하면 원문을 그대로 쓴다.
 */
function formatIsoDate(iso: string, t: SeoTranslator): string {
    const [y, m, d] = iso.split('-');
    if (y === undefined || m === undefined || d === undefined) return iso;
    const month = Number(m);
    const day = Number(d);
    if (Number.isNaN(month) || Number.isNaN(day)) return iso;
    return t('isoDate', { v0: y, v1: month, v2: day });
}

function labelText(label: FearGreedLabel, t: EnumLabelTranslator): string {
    return sentimentLabelText(label, t);
}

/** 최신 봉에서 `back`개 앞선 지점. 시계열이 짧으면 `null`. */
function pointBefore(
    points: readonly ScoredPoint[],
    back: number
): ScoredPoint | null {
    return points[points.length - 1 - back] ?? null;
}

/** 대략적인 거래일 환산 — `FearGreedComparisonGauges`가 쓰는 값과 같다. */
const TRADING_DAYS = { week: 5, month: 21, year: 252 } as const;

/**
 * 현재 점수를 1주/1개월/1년 전과 비교하는 문장(P1).
 *
 * **이 페이지가 자기 설명을 지키게 만드는 문장이다.** 가이드 산문은 "자기 정규화 점수라
 * 종목 간 비교는 무의미하고 시간축 추적이 올바른 사용법"이라고 안내하는데, 정작 크롤
 * 텍스트에는 시점 하나뿐이었다.
 *
 * 비교 대상이 하나도 없으면(신규 상장 등) `null`.
 */
export function buildFearGreedPeriodComparisonLine(
    points: readonly ScoredPoint[],
    t: EnumLabelTranslator,
    tFacts: SeoTranslator
): string | null {
    const current = points.at(-1);
    if (current === undefined) return null;

    /**
     * 절 **전체**를 로케일 메시지로 만든다.
     *
     * 한국어는 마지막 절만 종결어미(`높습니다`)를 쓰고 앞 절은 연결어미(`높고`)로
     * 이어야 문장이 된다 — 다른 언어에는 그 구분이 없다. 그래서 접미사를 따로
     * 붙이는 대신 `…Mid`/`…Final` 두 벌을 두고 각 로케일이 알아서 쓴다.
     * 받침에 따른 조사(`과`/`와`)도 ko 메시지 안에서만 다룬다.
     */
    const CLAUSE_KEY = {
        up: { mid: 'clauseUpMid', final: 'clauseUpFinal' },
        down: { mid: 'clauseDownMid', final: 'clauseDownFinal' },
        same: { mid: 'clauseSameMid', final: 'clauseSameFinal' },
    } as const;

    const clauses = (
        [
            ['periodWeek', TRADING_DAYS.week],
            ['periodMonth', TRADING_DAYS.month],
            ['periodYear', TRADING_DAYS.year],
        ] as const
    ).flatMap(([label, back]) => {
        const past = pointBefore(points, back);
        if (past === null) return [];
        const diff = Math.round(current.score) - Math.round(past.score);
        const kind = diff === 0 ? 'same' : diff > 0 ? 'up' : 'down';
        const anchor = tFacts('anchorPoint', {
            v0: tFacts(label),
            v1: Math.round(past.score),
            v2: labelText(past.label, t),
        });
        // 차이가 0이면 `대비 같고`가 되어 비문이다 — 조사를 붙여 `…(중립)과 같고`로 만든다.
        return [{ anchor, diff: Math.abs(diff), kind } as const];
    });

    if (clauses.length === 0) return null;
    const joined = clauses
        .map((c, i) =>
            tFacts(
                CLAUSE_KEY[c.kind][i === clauses.length - 1 ? 'final' : 'mid'],
                {
                    // 차이가 0인 절은 ko에서 `…(중립)과 같고`처럼 **조사**가
                    // 붙어야 문장이 된다. 받침 판정은 ICU가 못 하므로 소스가
                    // 앵커에 붙여서 넘긴다 — 그래야 메시지 인자 수가 네 로케일
                    // 모두 같아진다(플레이스홀더 패리티 게이트).
                    v0: c.kind === 'same' ? koWithParticle(c.anchor) : c.anchor,
                    v1: c.diff,
                }
            )
        )
        .join(', ');
    return tFacts('currentVsAnchors', {
        v0: Math.round(current.score),
        v1: labelText(current.label, t),
        v2: joined,
    });
}

/**
 * 최근 1년 점수 분포에서 현재 점수가 어디쯤인지(P2).
 *
 * 자기 정규화 점수가 만들어 내는 "43점이 이 종목 기준으로 낮은 건가?"라는 질문에
 * 답하는 문장이다. 날짜가 들어가 심볼별로 확실히 갈린다.
 *
 * 표본이 60개 미만이면 분포를 말할 근거가 약해 `null`.
 */
const MIN_DISTRIBUTION_SAMPLE = 60;

export function buildFearGreedYearRangeLine(
    points: readonly ScoredPoint[],
    tFacts: SeoTranslator
): string | null {
    const window = points.slice(-TRADING_DAYS.year);
    const current = window.at(-1);
    if (current === undefined || window.length < MIN_DISTRIBUTION_SAMPLE) {
        return null;
    }

    let min = window[0]!;
    let max = window[0]!;
    for (const p of window) {
        if (p.score < min.score) min = p;
        if (p.score > max.score) max = p;
    }

    const sorted = window.map(p => p.score).toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
        sorted.length % 2 === 0
            ? (sorted[mid - 1]! + sorted[mid]!) / 2
            : sorted[mid]!;
    const rank = sorted.filter(s => s <= current.score).length;
    const percentile = Math.round((rank / sorted.length) * 100);

    // 표본이 1년치에 못 미치면 "최근 1년"이라고 쓰면 안 된다. 신규 상장·KR/크립토처럼
    // 워밍업 뒤 점수가 252개가 안 되는 종목이 실제로 있고, 그때 이 문장은 사실과 다른
    // 크롤 텍스트가 된다 — 이 변경의 목적과 정반대다.
    const span =
        window.length >= TRADING_DAYS.year
            ? tFacts('lastYear')
            : tFacts('recentTradingDays', { v0: window.length });

    return tFacts('rangeSummary', {
        v0: span,
        v1: Math.round(min.score),
        v2: formatIsoDate(min.date, tFacts),
        v3: Math.round(max.score),
        v4: formatIsoDate(max.date, tFacts),
        v5: Math.round(median),
        v6: Math.round(current.score),
        v7: percentile,
    });
}

/**
 * 최근 1년을 5단계 라벨별 체류일로 쪼갠 문장(P5).
 *
 * 0일인 구간은 뺀다 — "극심한 탐욕 0일"은 글자만 늘리고 정보가 없다.
 */
export function buildFearGreedRegimeDistributionLine(
    points: readonly ScoredPoint[],
    t: EnumLabelTranslator,
    tFacts: SeoTranslator
): string | null {
    const window = points.slice(-TRADING_DAYS.year);
    if (window.length < MIN_DISTRIBUTION_SAMPLE) return null;

    const counts = new Map<FearGreedLabel, number>();
    for (const p of window) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);

    const parts = (
        ['EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED'] as const
    ).flatMap(label => {
        const n = counts.get(label) ?? 0;
        if (n === 0) return [];
        const pct = Math.round((n / window.length) * 100);
        // 1% 미만은 `(0%)`로 반올림돼 "1일(0%)" 같은 모순이 나온다 — 비율을 생략한다.
        return [
            tFacts('labelDaysCount', {
                v0: labelText(label, t),
                v1: n,
                v2: pct === 0 ? '' : `(${pct}%)`,
            }),
        ];
    });

    if (parts.length === 0) return null;
    // 위와 같은 이유 — `최근 1년 87거래일 중`은 그 자체로 모순이다.
    const span =
        window.length >= TRADING_DAYS.year
            ? tFacts('lastYear')
            : tFacts('recent');
    return tFacts('labelDistribution', {
        v0: span,
        v1: window.length,
        v2: parts.join(', '),
    });
}

/** 구간 전환 문장에 싣는 최근 전환 수. 더 길면 문장이 목록이 된다. */
const RECENT_TRANSITION_COUNT = 3;

/**
 * 최근 5단계 구간 전환 날짜를 나열한 문장.
 *
 * 날짜와 전후 라벨이 종목마다 달라 이 탭의 고유 텍스트를 늘린다. 전환이 없으면(1년
 * 내내 한 구간) `null` — 빈 문장을 내지 않는다.
 */
export function buildFearGreedTransitionLine(
    history: readonly FearGreedReading[],
    t: EnumLabelTranslator,
    tFacts: SeoTranslator
): string | null {
    const transitions = computeLabelTransitions(
        history,
        RECENT_TRANSITION_COUNT
    );
    if (transitions.length === 0) return null;
    const items = transitions.map(tr =>
        tFacts('regimeTransitionItem', {
            v0: formatIsoDate(tr.date, tFacts),
            v1: labelText(tr.from, t),
            v2: labelText(tr.to, t),
        })
    );
    return tFacts('regimeTransitions', {
        v0: items.join(tFacts('clauseJoin')),
    });
}

/**
 * 같은 날 시장 점수와의 차이 문장. 날짜가 맞는 쌍이 없으면 `null`이다 — 종목의
 * 마지막 봉과 시장 스냅샷의 기준일이 다를 수 있고, 다른 날끼리 비교하지 않는다.
 */
export function buildFearGreedMarketGapLine(
    history: readonly FearGreedReading[],
    market: FearGreedReading | null,
    marketLabel: string,
    tFacts: SeoTranslator
): string | null {
    if (market === null) return null;
    const gap = computeMarketScoreGap(history, market);
    if (gap === null) return null;
    const symbolScore = Math.round(gap.symbolScore);
    const marketScore = Math.round(gap.marketScore);
    const diff = symbolScore - marketScore;
    const key =
        diff === 0
            ? 'regimeMarketGapSame'
            : diff > 0
              ? 'regimeMarketGapUp'
              : 'regimeMarketGapDown';
    return tFacts(key, {
        v0: formatIsoDate(gap.date, tFacts),
        v1: marketLabel,
        v2: marketScore,
        v3: Math.abs(diff),
    });
}

/** 극단 구간 기록 표의 한 행 — 구간에 한 번 들어가 머문 기록. */
export interface ExtremeZoneEpisodeRow {
    /** 진입일 — `formatIsoDate`가 로케일 카탈로그(`isoDate`)로 포맷한 날짜. */
    readonly startDate: string;
    /** 그 기록에서 구간에 있던 마지막 날(포맷은 `startDate`와 같다). */
    readonly endDate: string;
    /** 구간 라벨이었던 거래일 수(잠깐 빠졌다 돌아온 날은 세지 않는다). */
    readonly sessions: number;
    /** 공포는 가장 낮은 점수, 탐욕은 가장 높은 점수. 점수가 없는 비정상 입력만 `null`. */
    readonly peakScore: number | null;
    /** 마지막 거래일이 이 기록 안에서 아직 그 구간이다. */
    readonly ongoing: boolean;
}

/** 극단 구간 하나의 기록 묶음. */
export interface ExtremeZoneSection {
    readonly zone: ExtremeFearGreedZone;
    readonly label: string;
    readonly entryCount: number;
    /** 기록별 머문 거래일 수의 중앙값. */
    readonly medianSessions: number;
    /** 최신순, 최대 {@link EXTREME_ZONE_RECORD_MAX_ROWS}개. */
    readonly rows: readonly ExtremeZoneEpisodeRow[];
    /** 표에서 뺀 더 오래된 기록 수. */
    readonly omittedCount: number;
}

/** 극단 구간 기록 전체. 진입이 한 번도 없으면 `sections`가 비어 있다. */
export interface ExtremeZoneRecord {
    /** 점수가 계산된 첫 거래일 — `formatIsoDate`가 로케일 카탈로그(`isoDate`)로 포맷한 날짜. */
    readonly from: string;
    /** 점수가 계산된 마지막 거래일(포맷은 `from`과 같다). */
    readonly to: string;
    readonly sections: readonly ExtremeZoneSection[];
}

/**
 * 구간마다 표에 싣는 최근 기록 수. 5년 기준 대형주는 구간당 5~15회라, 다 실으면 두 표가
 * 화면 하나를 넘는다. 더 오래된 기록은 개수만 밝힌다.
 */
export const EXTREME_ZONE_RECORD_MAX_ROWS = 8;

/**
 * 극심한 공포·극심한 탐욕 구간에 **언제 들어가 얼마나 머물렀는지**의 기록.
 *
 * 예전에는 진입 뒤 5·20·60거래일 종가 변화의 중앙값을 보였다. 20개 종목·5년으로 재 보니
 * 그 중앙값이 같은 수의 무작위 날짜 중앙값과 구별되지 않았다(siglens-core#256, 117칸 중
 * p<0.10이 10칸 — 우연 수준). 잡음이 숫자로 보이면 패턴처럼 읽혀 투자 권유 위험까지
 * 생기므로, 흔들리지 않는 사실(진입일·마지막 날·머문 거래일·극값 점수)만 보인다.
 * 수익률·평균·승률은 계산하지 않는다(core가 돌려주지 않는다).
 *
 * 화면은 집계 기간과 "과거 기록, 예측·권유 아님" 고지를 함께 그린다
 * (`FearGreedExtremeZoneRecord`). 이 함수는 표 데이터만 만들고 해석 문장을 만들지 않는다.
 *
 * 점수가 계산된 구간이 없으면 `null`이다.
 */
export function buildExtremeZoneRecord(
    history: readonly FearGreedReading[],
    t: EnumLabelTranslator,
    tFacts: SeoTranslator
): ExtremeZoneRecord | null {
    const scored = history.filter(p => p.score !== null);
    const first = scored.at(0);
    const last = scored.at(-1);
    if (first === undefined || last === undefined) return null;
    const sections = summarizeExtremeZoneEpisodes(history).flatMap(
        (record): ExtremeZoneSection[] =>
            record.medianSessionsInZone === null
                ? []
                : [
                      {
                          zone: record.zone,
                          label: labelText(record.zone, t),
                          entryCount: record.entryCount,
                          medianSessions: record.medianSessionsInZone,
                          rows: record.episodes
                              .slice(0, EXTREME_ZONE_RECORD_MAX_ROWS)
                              .map(episode => ({
                                  startDate: formatIsoDate(
                                      episode.startDate,
                                      tFacts
                                  ),
                                  endDate: formatIsoDate(
                                      episode.endDate,
                                      tFacts
                                  ),
                                  sessions: episode.sessionsInZone,
                                  peakScore:
                                      episode.peakScore === null
                                          ? null
                                          : Math.round(episode.peakScore),
                                  ongoing: episode.ongoing,
                              })),
                          omittedCount: Math.max(
                              0,
                              record.episodes.length -
                                  EXTREME_ZONE_RECORD_MAX_ROWS
                          ),
                      },
                  ]
    );
    return {
        from: formatIsoDate(first.date, tFacts),
        to: formatIsoDate(last.date, tFacts),
        sections,
    };
}

/** 메타 설명에 싣는 사실 — 구조만 담고 문구는 호출부(`composeFearGreedDescription`)가 만든다. */
export interface FearGreedMetaFacts {
    /** 마지막 점수 봉의 날짜 `YYYY-MM-DD`. */
    readonly date: string;
    readonly score: number;
    readonly label: FearGreedLabel;
    /** 확보된 비교 시점만(1주·1개월·1년 전). */
    readonly past: readonly {
        readonly period: 'week' | 'month' | 'year';
        readonly score: number;
    }[];
    /** 최근 1년(또는 확보된 거래일) 점수 범위. 표본이 60개 미만이면 `null`. */
    readonly range: {
        readonly min: number;
        readonly max: number;
        /** 252거래일 이상이면 `null`("최근 1년"), 아니면 실제 거래일 수. */
        readonly days: number | null;
    } | null;
}

/**
 * 공포·탐욕 탭 `<meta description>`용 사실. 본문의 시계열 문장
 * (`buildFearGreedPeriodComparisonLine`·`buildFearGreedYearRangeLine`)과 **같은 기준**
 * (거래일 환산·60개 표본 하한)을 쓴다 — 설명과 본문의 숫자가 갈리지 않는다.
 * 점수가 하나도 없으면 `null`(호출부가 템플릿 설명으로 떨어진다).
 */
export function buildFearGreedMetaFacts(
    points: readonly ScoredPoint[]
): FearGreedMetaFacts | null {
    const current = points.at(-1);
    if (current === undefined) return null;

    const past = (
        [
            ['week', TRADING_DAYS.week],
            ['month', TRADING_DAYS.month],
            ['year', TRADING_DAYS.year],
        ] as const
    ).flatMap(([period, back]) => {
        const point = pointBefore(points, back);
        return point === null
            ? []
            : [{ period, score: Math.round(point.score) }];
    });

    const window = points.slice(-TRADING_DAYS.year);
    const range =
        window.length < MIN_DISTRIBUTION_SAMPLE
            ? null
            : {
                  min: Math.round(Math.min(...window.map(p => p.score))),
                  max: Math.round(Math.max(...window.map(p => p.score))),
                  days:
                      window.length >= TRADING_DAYS.year ? null : window.length,
              };

    return {
        date: current.date,
        score: Math.round(current.score),
        label: current.label,
        past,
        range,
    };
}
