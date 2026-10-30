import type { OptionsExpirationSelector } from '@/shared/lib/types';

/**
 * 선택한 만기 값에 해당하는 표시용 체인을 고른다.
 *
 * 옵션 페이지는 세 화면(지표 행, OI 차트, 체인 테이블)이 하나의 선택 축을 공유한다.
 * 규칙 — `"all"`이면 가장 가까운 만기, 아니면 정확히 일치하는 만기(없으면 가장 가까운
 * 만기로 안전망) — 을 한 곳에 둔다.
 *
 * 스냅샷에 체인이 하나도 없으면 `null`이다(호출자가 빈 상태를 그린다).
 *
 * 체인 타입에 대해 제네릭이다 — 서버의 전체 `OptionsSnapshot`과 클라이언트로 투영된
 * `ClientOptionsSnapshot`이 같은 규칙을 쓴다.
 */
export function pickActiveChain<C extends { expirationDate: string }>(
    snapshot: { chains: ReadonlyArray<C> },
    expirationDate: OptionsExpirationSelector
): C | null {
    const chains = snapshot.chains;
    if (chains.length === 0) return null;
    const nearestChain = chains[0];
    if (expirationDate === 'all') return nearestChain;
    return (
        chains.find(c => c.expirationDate === expirationDate) ?? nearestChain
    );
}
