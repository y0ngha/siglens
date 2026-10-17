/** 한 CUSIP을 여러 심볼이 주장한 건 — 남긴 심볼과 버린 심볼들. */
export interface CusipConflict {
    cusip: string;
    /** 맵에 남는 심볼(이미 맵에 있던 살아 있는 심볼이면 그것, 아니면 사전순 가장 앞). */
    kept: string;
    /** 이번 쓰기에서 버린 심볼(사전순). */
    dropped: string[];
}

export interface CusipMapResolution<T> {
    rows: T[];
    conflicts: CusipConflict[];
}

/**
 * `cusip_symbol_map`에 쓸 행을 CUSIP당 하나로 줄인다 — 맵은 CUSIP이 유일 키라, 한 문장에 같은 CUSIP이 두 번 들어가면
 * Postgres가 21000(`ON CONFLICT DO UPDATE command cannot affect row a second time`)으로 실행 전체를 거부한다. 실제 유니버스에서는
 * 한 증권의 표기 변형(`BRK.B`·`BRK-B`)이나 FMP가 우선주·워런트·유닛 티커에 보통주 CUSIP을 돌려주는 경우로 두 심볼이 한 CUSIP을
 * 주장한다.
 *
 * 규칙(결정적, 입력 순서와 무관):
 *  1. `existingLiveSymbolByCusip`에 이 CUSIP이 있으면(= 이미 맵에 있고 그 심볼이 아직 상장된 미국 종목) **그 심볼을 남긴다** —
 *     입력에 그 심볼이 없으면 이 CUSIP의 입력 행을 모두 버린다. 다른 심볼이 매 실행 맵을 번갈아 덮지 않게 하는 규칙이다.
 *  2. 없으면 **사전순 가장 앞 심볼**을 남긴다 — 보통주 티커가 파생 상장(`XYZ` < `XYZ-PA`·`XYZU`·`XYZW`)보다 앞이다.
 * 같은 (CUSIP, 심볼)이 여러 번이면 뒤 행이 이긴다(`dedupeByKey`와 같다). 맵에 있던 심볼이 상장 폐지됐으면(티커 변경 `FB`→`META`)
 * 1을 적용하지 않아 새 심볼이 덮는다 — 기존 동작이다.
 */
export function resolveCusipMapConflicts<
    T extends { cusip: string; symbol: string },
>(
    rows: readonly T[],
    existingLiveSymbolByCusip: ReadonlyMap<string, string>
): CusipMapResolution<T> {
    // CUSIP별로 묶고, 그 안에서 심볼당 뒤 행이 이긴다(`Map` 생성자는 같은 키를 뒤 값으로 덮는다).
    const byCusip = [...Map.groupBy(rows, row => row.cusip)].map(
        ([cusip, group]) =>
            [cusip, new Map(group.map(row => [row.symbol, row]))] as const
    );
    const resolved = byCusip.map(([cusip, group]) => {
        const symbols = [...group.keys()].toSorted();
        const kept = existingLiveSymbolByCusip.get(cusip) ?? symbols[0];
        const dropped = symbols.filter(symbol => symbol !== kept);
        const row = kept === undefined ? undefined : group.get(kept);
        return {
            row,
            conflict:
                dropped.length > 0 && kept !== undefined
                    ? { cusip, kept, dropped }
                    : null,
        };
    });
    return {
        rows: resolved.flatMap(({ row }) => (row === undefined ? [] : [row])),
        conflicts: resolved.flatMap(({ conflict }) =>
            conflict === null ? [] : [conflict]
        ),
    };
}

/**
 * 맵에 이미 있는 매핑(`mapped`) 중 `rows`의 **다른 심볼**이 같은 CUSIP을 주장하는 것 — `upsertCusipMap`이 그 심볼의 상장 여부를
 * 확인할 대상이다. CUSIP → 입력 심볼 집합을 한 번 만들어 매핑마다 바로 찾는다(입력 × 매핑 전수 대조를 피한다).
 */
export function findContestedMappings<
    M extends { cusip: string; symbol: string },
>(
    rows: readonly { cusip: string; symbol: string }[],
    mapped: readonly M[]
): M[] {
    const symbolsByCusip = new Map(
        [...Map.groupBy(rows, row => row.cusip)].map(([cusip, group]) => [
            cusip,
            new Set(group.map(row => row.symbol)),
        ])
    );
    return mapped.filter(existing => {
        const claimed = symbolsByCusip.get(existing.cusip);
        // 같은 CUSIP의 입력 심볼 중 맵의 심볼과 다른 것이 하나라도 있으면 다툼이다.
        return (
            claimed !== undefined &&
            (claimed.size > 1 || !claimed.has(existing.symbol))
        );
    });
}
