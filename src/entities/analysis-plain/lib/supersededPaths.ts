import type { ProseEntry } from '@/entities/analysis-translation';

/**
 * 재생성본이 존재하는 경로를 프롬프트 입력에서 제거한다.
 *
 * core의 `ReconciledActionLevels.exit`/`.riskReward`는 JSDoc상
 * "Regenerated ... reflecting the reconciled levels" — 형제 필드
 * `actionRecommendation.exit`/`.riskReward`를 **대체하는** 값이다. 둘 다 넘기면
 * 모델이 이를 서로 다른 두 분석으로 착각한다. 실측 출력:
 *
 *   "참고로 다른 분석에서는 목표가를 334.01달러, 손절을 308.97달러로 제시하기도 했는데"
 *
 * 한 화면에 모순된 매매 가격 두 벌이 나오는 상태다. 프롬프트 규칙이 아니라 입력에서
 * 잘라내는 이유는 이 결함의 비용(금액 오안내)이 프롬프트 준수율에 맡길 수준이
 * 아니기 때문이다.
 *
 * `reconciledLevels.reason`은 보정 사유 툴팁 문구라 독자용이 아니다.
 * `actionRecommendation.entry`는 대응 재생성본이 없으므로 유지한다.
 *
 * `extractProse` 자체는 고치지 않는다 — i18n 번역(`analysis-translation`)이 같은
 * 함수를 공유하며, 거기서는 이 경로들도 번역 대상이어야 한다.
 */
const MARKER_PREFIX = 'actionRecommendation.reconciledLevels.';

const SUPERSEDED_PATHS: ReadonlySet<string> = new Set([
    'actionRecommendation.exit',
    'actionRecommendation.riskReward',
    'actionRecommendation.reconciledLevels.reason',
]);

export function dropSupersededPaths(
    entries: readonly ProseEntry[]
): ProseEntry[] {
    const hasReconciled = entries.some(entry =>
        entry.path.startsWith(MARKER_PREFIX)
    );
    if (!hasReconciled) return [...entries];
    return entries.filter(entry => !SUPERSEDED_PATHS.has(entry.path));
}
