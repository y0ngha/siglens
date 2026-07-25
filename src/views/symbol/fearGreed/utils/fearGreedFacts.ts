import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FACTOR_LABEL, formatFactorRaw } from '@/shared/lib/fearGreedLabels';

// 5-factor percentile을 낮음/보통/높음 3구간으로 나누는 경계값. FearGreedGroupBar의
// "극단" 배지 임계값(<10 / >=90)보다 넓게 잡아, 문장 서사에서는 "평소 범위 밖"을
// 조금 더 자주 언급하도록 한다(크롤 텍스트는 정보 밀도가 UI 배지보다 중요).
const LOW_PERCENTILE_MAX = 25;
const HIGH_PERCENTILE_MIN = 75;

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
 */
export function buildFearGreedFactorLines(
    snapshot: FearGreedSnapshot
): string[] {
    return snapshot.groups.flatMap(group =>
        group.factors.map(factor => {
            const pctile = Math.round(factor.percentile);
            return `${FACTOR_LABEL[factor.key]}: ${formatFactorRaw(factor.key, factor.rawValue)} (${pctile}th 퍼센타일) — ${factorInterpretation(pctile)}.`;
        })
    );
}
