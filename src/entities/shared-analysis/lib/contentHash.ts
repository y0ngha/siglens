import { createHash } from 'node:crypto';

/**
 * kind + symbol + result (+ chartBars for chart kind) を使った dedupe 用安定ハッシュ生成。
 *
 * chart kind では `chartBars` をハッシュに含める。これにより、同じ AI 分析結果でも
 * 異なる時点のチャートデータを持つ共有は別スナップショットとして扱われ、
 * 各共有者が共有時点のチャートをそのまま保持できる。
 *
 * 非 chart kind では `chartBars` を省略することで従来のハッシュ互換性を維持する。
 *
 * Covers: kind, symbol, result, and (for chart kind) chartBars.
 */
export function contentHash(
    kind: string,
    symbol: string,
    result: unknown,
    chartBars?: unknown
): string {
    const payload = JSON.stringify({
        kind,
        symbol: symbol.toUpperCase(),
        result,
        ...(chartBars !== undefined && { chartBars }),
    });
    return createHash('sha256').update(payload).digest('hex');
}
