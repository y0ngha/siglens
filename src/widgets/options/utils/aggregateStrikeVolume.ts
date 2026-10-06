import type { ClientOptionsChain } from '@/entities/options-chain/lib/clientOptionsSnapshot';

/**
 * Per-strike aggregated trade volume across the call and put sides of a
 * single expiration. Mirrors `StrikeOpenInterest` from siglens-core but
 * tracks today's session volume instead of cumulative open interest, so
 * the UI can show "where did trading happen today" alongside the OI
 * "cumulative bets" view.
 */
export interface StrikeVolume {
    /** Strike price in the underlying's currency. */
    strike: number;
    /** Sum of call-contract volume at this strike. */
    callVolume: number;
    /** Sum of put-contract volume at this strike. */
    putVolume: number;
}

/**
 * Add a single contract's volume to the call or put side of the strike
 * bucket. Mutates the accumulator in place by design — the wrapper
 * `reduce` owns the only Map instance and threads it through, so this
 * helper encapsulates the lone `map.set` call site behind a functional
 * reduce signature (no `for` + outer-scope mutation; MISTAKES.md §21).
 */
function bumpStrikeVolume(
    acc: Map<number, StrikeVolume>,
    strike: number,
    side: 'call' | 'put',
    volume: number
): Map<number, StrikeVolume> {
    const prev = acc.get(strike) ?? { strike, callVolume: 0, putVolume: 0 };
    acc.set(strike, {
        ...prev,
        callVolume:
            side === 'call' ? prev.callVolume + volume : prev.callVolume,
        putVolume: side === 'put' ? prev.putVolume + volume : prev.putVolume,
    });
    return acc;
}

/**
 * Aggregate call/put trade volume per strike for a single expiration.
 *
 * Same shape as `aggregateOpenInterest` in siglens-core — strike-keyed
 * Map accumulation, then ascending sort — but reads `volume` instead of
 * `openInterest`. Sides without a contract at a given strike contribute
 * `0`. Duplicate contracts at the same strike (rare but theoretically
 * possible on some providers) are summed naturally because the Map keys
 * on strike, not on contract symbol.
 *
 * @param chain - Options chain for a single expiration.
 * @returns Strike-grouped volume totals sorted ascending by strike;
 *   readonly so downstream consumers must not mutate.
 */
export function aggregateStrikeVolume(
    chain: ClientOptionsChain
): StrikeVolume[] {
    // 두 reduce를 직렬로 연결해 같은 Map accumulator를 calls → puts
    // 순으로 통과시킨다. 이전의 `tagged` 중간 배열(spread + 두 map +
    // 객체 alloc)을 제거해 컨트랙트 개수에 비례하던 임시 할당을 없앴다.
    const byStrike = chain.puts.reduce(
        (acc, p) => bumpStrikeVolume(acc, p.strike, 'put', p.volume),
        chain.calls.reduce(
            (acc, c) => bumpStrikeVolume(acc, c.strike, 'call', c.volume),
            new Map<number, StrikeVolume>()
        )
    );
    return [...byStrike.values()].toSorted((a, b) => a.strike - b.strike);
}
