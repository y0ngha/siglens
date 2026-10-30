'use client';

/**
 * 재무제표 연간/분기 토글 상태 훅 — 분기 데이터는 처음 전환할 때 한 번만 지연 조회한다.
 */
import { useState, useRef } from 'react';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { fetchAndApplyQuarterSnapshot } from '../utils/financialsPeriodUtils';

interface UseFinancialsPeriodResult {
    period: StatementPeriod;
    setPeriod: (period: StatementPeriod) => void;
    snapshot: FinancialsSnapshot;
    isLoading: boolean;
    /** 직전 분기 조회가 실패해 연간으로 되돌아왔는지 — 안내 문구를 띄우는 근거다. */
    quarterUnavailable: boolean;
}

/**
 * 재무제표 페이지의 연간/분기 토글을 관리한다.
 *
 * - 'annual': SSR이 준 `initialAnnualSnapshot`을 조회 없이 바로 쓴다.
 * - 'quarter': 첫 전환 때 `getFinancialsQuarterAction`을 부르고, 결과는 상태에 보관해 이후
 *   전환은 즉시 바뀐다.
 *
 * 분기 조회는 한 번에 하나만 돈다. 조회 중에 분기를 다시 눌러도 요청을 또 만들지 않는다 —
 * 중복 요청이 서로 다른 시점에 끝나면 늦게 실패한 쪽이 먼저 성공한 결과 위에서 기간을
 * 되돌릴 수 있다.
 *
 * 실패(reject, 또는 전부 빈 스냅샷으로 resolve)는 연간으로 되돌리고 `quarterUnavailable`을
 * 켠다 — 말없이 되돌아가면 사용자가 눌렀는데 아무 일도 없었다고 읽는다. 빈 스냅샷은 캐시하지
 * 않는다.
 *
 * react-query 대신 상태를 직접 쓰는 이유: 이 조회는 심볼 단위의 일회성 요청이고 수명 주기가
 * 이 훅 인스턴스에 온전히 속해, 세션 캐시의 이점이 QueryClient·queryKey 보일러플레이트를
 * 정당화하지 못한다.
 */
export function useFinancialsPeriod(
    symbol: string,
    initialAnnualSnapshot: FinancialsSnapshot
): UseFinancialsPeriodResult {
    const [period, setPeriodState] = useState<StatementPeriod>('annual');
    const [quarterSnapshot, setQuarterSnapshot] =
        useState<FinancialsSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [quarterUnavailable, setQuarterUnavailable] = useState(false);

    // 렌더와 무관한 동기 가드라 state가 아니라 ref다 — 같은 틱의 연속 클릭도 막아야 한다.
    const isFetchingRef = useRef(false);
    // 늦게 도착한 실패가 사용자가 이미 연간으로 돌아간 화면에 안내를 띄우지 않도록, 사용자가 마지막으로 고른 기간을 따라간다.
    const periodRef = useRef<StatementPeriod>('annual');

    const snapshot =
        period === 'quarter' && quarterSnapshot !== null
            ? quarterSnapshot
            : initialAnnualSnapshot;

    const setPeriod = (next: StatementPeriod) => {
        periodRef.current = next;
        if (next === 'annual') {
            setPeriodState('annual');
            setQuarterUnavailable(false);
            return;
        }

        if (quarterSnapshot !== null || isFetchingRef.current) {
            setPeriodState('quarter');
            return;
        }

        isFetchingRef.current = true;
        setPeriodState('quarter');
        setQuarterUnavailable(false);
        setIsLoading(true);
        void fetchAndApplyQuarterSnapshot(symbol, {
            setPeriodState,
            setQuarterSnapshot,
            setIsLoading,
            setQuarterUnavailable: unavailable => {
                if (!unavailable || periodRef.current === 'quarter') {
                    setQuarterUnavailable(unavailable);
                }
            },
        }).finally(() => {
            isFetchingRef.current = false;
        });
    };

    return { period, setPeriod, snapshot, isLoading, quarterUnavailable };
}
