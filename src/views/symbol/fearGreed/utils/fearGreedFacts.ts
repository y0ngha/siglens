import type {
    FearGreedFactor,
    FearGreedGroupName,
    FearGreedSnapshot,
} from '@y0ngha/siglens-core';
import { FACTOR_LABEL, formatFactorRaw } from '@/shared/lib/fearGreedLabels';

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
