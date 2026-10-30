/**
 * Decide which strike indices show an x-axis label.
 *
 * Thins to an even stride, then pins the visual anchors (last index, current
 * price, Max Pain). Anchors always win: a stride index closer than one stride
 * to any anchor is dropped so adjacent labels never overlap. Anchors
 * themselves are kept even when adjacent to each other, so the result can hold
 * a few more than `maxLabels` entries.
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
    const pinned = [count - 1, ...anchors.filter(a => a >= 0 && a < count)];
    const spacedStrideIndices = strideIndices.filter(index =>
        pinned.every(anchor => Math.abs(anchor - index) >= stride)
    );
    return new Set([...spacedStrideIndices, ...pinned]);
}
