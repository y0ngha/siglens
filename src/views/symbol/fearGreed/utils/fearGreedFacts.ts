import type {
    FearGreedFactor,
    FearGreedGroupName,
    FearGreedHistoryPoint,
    FearGreedLabel,
    FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import {
    FACTOR_LABEL,
    formatFactorRaw,
    SENTIMENT_LABEL_TEXT,
} from '@/shared/lib/fearGreedLabels';

// 5-factor percentile을 낮음/보통/높음 3구간으로 나누는 경계값. FearGreedGroupBar의
// "극단" 배지 임계값(<10 / >=90)보다 넓게 잡아, 문장 서사에서는 "평소 범위 밖"을
// 조금 더 자주 언급하도록 한다(크롤 텍스트는 정보 밀도가 UI 배지보다 중요).
const LOW_PERCENTILE_MAX = 25;
const HIGH_PERCENTILE_MIN = 75;
// factor/group 점수 percentile 척도의 중앙값. "평소 수준"에서 얼마나 벗어났는지
// 판단하는 기준점으로 findMostExtremeFactor·buildFearGreedFactorRankingLine이 공유한다.
const MEDIAN_PERCENTILE = 50;

function factorInterpretation(pctile: number): string {
    if (pctile < LOW_PERCENTILE_MAX) {
        return '최근 200영업일 분포 대비 낮은 편';
    }
    if (pctile >= HIGH_PERCENTILE_MIN) {
        return '최근 200영업일 분포 대비 높은 편';
    }
    return '최근 200영업일 분포의 평균 범위 안';
}

/**
 * snapshot의 5-factor breakdown(Flow 3개 + Trend 2개)을 크롤 가능한 한 줄
 * 문장으로 변환한다. `snapshot.groups`의 원 순서(Flow → Trend)를 그대로
 * 따른다. 순수 함수 — 시간/난수 의존 없음.
 *
 * `${pctile}번째 퍼센타일`(FIX 6, audit) — 이전엔 `${pctile}th 퍼센타일`로
 * 영어 서수 접미사가 한국어 문장에 섞여 있었다.
 */
export function buildFearGreedFactorLines(
    snapshot: FearGreedSnapshot
): string[] {
    return snapshot.groups.flatMap(group =>
        group.factors.map(factor => {
            const pctile = Math.round(factor.percentile);
            return `${FACTOR_LABEL[factor.key]}: ${formatFactorRaw(factor.key, factor.rawValue)} (${pctile}번째 퍼센타일) — ${factorInterpretation(pctile)}.`;
        })
    );
}

const GROUP_LABEL: Record<FearGreedGroupName, string> = {
    Flow: '수급',
    Trend: '추세',
};

/**
 * Flow/Trend 두 그룹 점수를 비교하는 심볼별 서사 문장을 만든다(audit fix
 * FIX 6, option b). 기존 `buildFearGreedFactorLines`는 factor 5개 각각을
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
    snapshot: FearGreedSnapshot
): string | null {
    const flow = snapshot.groups.find(g => g.name === 'Flow');
    const trend = snapshot.groups.find(g => g.name === 'Trend');
    if (!flow || !trend) return null;

    const flowScore = Math.round(flow.score);
    const trendScore = Math.round(trend.score);

    if (flowScore === trendScore) {
        return `${GROUP_LABEL.Flow} 그룹과 ${GROUP_LABEL.Trend} 그룹이 모두 ${flowScore}점으로 균형 잡힌 흐름을 보이고 있습니다.`;
    }

    const leader = flowScore > trendScore ? flow : trend;
    const lagging = flowScore > trendScore ? trend : flow;
    const leaderScore = Math.round(leader.score);
    const laggingScore = Math.round(lagging.score);
    const gap = leaderScore - laggingScore;

    return `${GROUP_LABEL[leader.name]} 그룹 점수(${leaderScore}점)가 ${GROUP_LABEL[lagging.name]} 그룹(${laggingScore}점)보다 ${gap}점 높아 ${GROUP_LABEL[leader.name]} 우위 흐름입니다.`;
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
    snapshot: FearGreedSnapshot
): string | null {
    const allFactors = snapshot.groups.flatMap(g => g.factors);
    const top = findMostExtremeFactor(allFactors);
    if (top === null) return null;

    const pctile = Math.round(top.percentile);
    const direction = pctile >= MEDIAN_PERCENTILE ? '높게' : '낮게';

    return `${allFactors.length}개 지표 중 가장 두드러진 지표는 ${FACTOR_LABEL[top.key]}로, ${pctile}번째 퍼센타일을 기록해 평소보다 ${direction} 나타나고 있습니다.`;
}

/**
 * `computeFearGreedHistory`가 돌려준 시계열에서 warm-up(`score === null`)을 걷어낸다.
 * 아래 시계열 문장 3종이 공유하는 전처리다.
 */
type ScoredPoint = { date: string; score: number; label: FearGreedLabel };

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
function formatIsoDateKo(iso: string): string {
    const [y, m, d] = iso.split('-');
    if (y === undefined || m === undefined || d === undefined) return iso;
    const month = Number(m);
    const day = Number(d);
    if (Number.isNaN(month) || Number.isNaN(day)) return iso;
    return `${y}년 ${month}월 ${day}일`;
}

/** 받침 유무로 `와`/`과`를 고른다. 라벨이 5종뿐이라 한글 음절 범위 검사면 충분하다. */
function withParticle(word: string): string {
    const last = word.codePointAt(word.length - 1) ?? 0;
    const hasBatchim =
        last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
    return `${word}${hasBatchim ? '과' : '와'}`;
}

function labelText(label: FearGreedLabel): string {
    return SENTIMENT_LABEL_TEXT[label];
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
    points: readonly ScoredPoint[]
): string | null {
    const current = points.at(-1);
    if (current === undefined) return null;

    // 마지막 절만 종결어미(`높습니다`)를 쓰고 앞 절은 연결어미(`높고`)로 잇는다.
    // 종결어미를 쉼표로 나열하면 한국어 문장이 안 된다.
    const CONNECTIVE = { up: '높고', down: '낮고', same: '같고' } as const;
    const FINAL = {
        up: '높습니다',
        down: '낮습니다',
        same: '같습니다',
    } as const;

    const clauses = (
        [
            ['1주 전', TRADING_DAYS.week],
            ['1개월 전', TRADING_DAYS.month],
            ['1년 전', TRADING_DAYS.year],
        ] as const
    ).flatMap(([label, back]) => {
        const past = pointBefore(points, back);
        if (past === null) return [];
        const diff = Math.round(current.score) - Math.round(past.score);
        const kind = diff === 0 ? 'same' : diff > 0 ? 'up' : 'down';
        const anchor = `${label} ${Math.round(past.score)}점(${labelText(past.label)})`;
        // 차이가 0이면 `대비 같고`가 되어 비문이다 — 조사를 붙여 `…(중립)과 같고`로 만든다.
        const head =
            kind === 'same'
                ? `${withParticle(anchor)} `
                : `${anchor} 대비 ${Math.abs(diff)}점 `;
        return [{ head, kind } as const];
    });

    if (clauses.length === 0) return null;
    const joined = clauses
        .map(
            (c, i) =>
                c.head +
                (i === clauses.length - 1 ? FINAL[c.kind] : CONNECTIVE[c.kind])
        )
        .join(', ');
    return `현재 ${Math.round(current.score)}점(${labelText(current.label)})은 ${joined}.`;
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
    points: readonly ScoredPoint[]
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
            ? '최근 1년'
            : `최근 ${window.length}거래일`;

    return `${span} 동안 이 종목의 점수는 최저 ${Math.round(min.score)}점(${formatIsoDateKo(min.date)})에서 최고 ${Math.round(max.score)}점(${formatIsoDateKo(max.date)}) 사이에서 움직였고, 중앙값은 ${Math.round(median)}점입니다. 현재 ${Math.round(current.score)}점은 이 분포에서 ${percentile}% 지점에 해당합니다.`;
}

/**
 * 최근 1년을 5단계 라벨별 체류일로 쪼갠 문장(P5).
 *
 * 0일인 구간은 뺀다 — "극심한 탐욕 0일"은 글자만 늘리고 정보가 없다.
 */
export function buildFearGreedRegimeDistributionLine(
    points: readonly ScoredPoint[]
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
        return [`${labelText(label)} ${n}일${pct === 0 ? '' : `(${pct}%)`}`];
    });

    if (parts.length === 0) return null;
    // 위와 같은 이유 — `최근 1년 87거래일 중`은 그 자체로 모순이다.
    const span = window.length >= TRADING_DAYS.year ? '최근 1년' : '최근';
    return `${span} ${window.length}거래일 중 ${parts.join(', ')}을 기록했습니다.`;
}
