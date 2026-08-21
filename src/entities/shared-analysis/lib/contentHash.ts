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
 * Covers: kind, symbol, locale, result, and (for chart kind) chartBars.
 *
 * **`locale`이 페이로드에 있어야 하는 이유**: dedupe는 `content_hash` **단독**
 * unique 인덱스(`shared_analyses_content_uq`)로 걸리고, `create()`는 충돌 시
 * `expiresAt`만 갱신하고 기존 행의 id를 돌려준다. 로케일이 해시에 없으면 영어
 * 사용자가 만든 공유 링크가 **먼저 저장된 한국어 스냅샷의 id**를 받게 되고,
 * 그 사용자는 자기가 보지 않은 언어의 분석을 공유하게 된다(설계 §2.5).
 *
 * unique 제약을 `(content_hash, locale)`로 넓히지 않고 해시에 넣은 이유:
 * 인덱스·쿼리를 그대로 두고도 로케일이 다르면 해시가 달라져 자연히 다른 행이
 * 된다. 기존 행의 해시는 무효가 되지만 **공유 링크는 `id`로 조회하므로 살아
 * 있다** — 새 해시는 새 공유를 만들 때만 쓰인다.
 */
export function contentHash(
    kind: string,
    symbol: string,
    locale: string,
    result: unknown,
    chartBars?: unknown
): string {
    const payload = JSON.stringify({
        kind,
        symbol: symbol.toUpperCase(),
        locale,
        result,
        ...(chartBars !== undefined && { chartBars }),
    });
    return createHash('sha256').update(payload).digest('hex');
}
