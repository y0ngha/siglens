/**
 * Decide which strike indices show an x-axis label.
 *
 * 균등 stride로 thin 처리하되, 시각적 기준점인 양 끝·현재가·Max Pain
 * 인덱스는 무조건 포함한다. stride 계산이 ceil 기반이라 stride 자체로
 * 대략 `maxLabels` 개수가 잡히지만, anchors(현재가·Max Pain·
 * 마지막 인덱스)가 stride 위치와 겹치지 않으면 최종 개수는 이보다
 * 1~3개 정도 더 많아질 수 있다.
 */
export function pickLabelIndices(
    count: number,
    anchors: ReadonlyArray<number>,
    maxLabels: number
): Set<number> {
    if (count <= maxLabels) {
        return new Set(Array.from({ length: count }, (_, i) => i));
    }
    const stride = Math.ceil(count / maxLabels);
    const strideIndices = Array.from(
        { length: Math.ceil(count / stride) },
        (_, k) => k * stride
    );
    const validAnchors = anchors.filter(a => a >= 0 && a < count);
    return new Set([...strideIndices, count - 1, ...validAnchors]);
}
