import { createHash } from 'node:crypto';

/**
 * 공유 dedupe용 안정 해시. kind, symbol, locale, result에 더해 chart kind의
 * `chartBars`와 `plain`을 페이로드에 넣는다. `createShareSnapshotAction`이 쓴다.
 *
 * chart kind에서 `chartBars`를 해시에 포함하는 이유: 같은 AI 분석 결과여도 다른
 * 시점의 차트 데이터를 가진 공유는 별도 스냅샷이어야, 각 공유자가 공유 시점의
 * 차트를 그대로 보존한다. 비 chart kind는 `chartBars`를 페이로드에서 빼 기존
 * 해시와 호환된다.
 *
 * **`locale`이 페이로드에 있어야 하는 이유**: dedupe는 `content_hash` **단독**
 * unique 인덱스(`shared_analyses_content_uq`)로 걸리고, `create()`는 충돌 시
 * `expiresAt`만 갱신하고 기존 행의 id를 돌려준다. 로케일이 해시에 없으면 영어
 * 사용자가 만든 공유 링크가 **먼저 저장된 한국어 스냅샷의 id**를 받게 되고,
 * 그 사용자는 자기가 보지 않은 언어의 분석을 공유하게 된다.
 *
 * **`plain`도 같은 이유로 해시에 들어간다.** 분석 결과는 캐시를 통해 여러
 * 사용자가 공유하므로 `result`가 글자 하나까지 같은 공유가 흔하다. 그런데
 * 평이화는 늦게 도착하거나(등록 시점 race) 가드에 걸려 없을 수 있어, 같은
 * `result`인데 `plain`만 다른 공유가 실제로 생긴다. 해시에 없으면 먼저 저장된
 * 행이 이겨서(`ON CONFLICT`는 `expiresAt`만 갱신한다) 두 번째 공유자의 산문이
 * 조용히 버려지고, 링크를 받은 사람은 쉽게보기 토글을 못 본다 —
 * `chartBars`를 해시에 넣은 것과 정확히 같은 실패 형태다.
 *
 * `plain`이 없는 공유는 페이로드에서 키 자체가 빠지므로 이 필드 도입 이전에
 * 만들어진 행의 해시와 그대로 호환된다.
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
    chartBars?: unknown,
    plain?: string
): string {
    const payload = JSON.stringify({
        kind,
        symbol: symbol.toUpperCase(),
        locale,
        result,
        ...(chartBars !== undefined && { chartBars }),
        ...(plain !== undefined && { plain }),
    });
    return createHash('sha256').update(payload).digest('hex');
}
