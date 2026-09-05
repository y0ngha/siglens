'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import type {
    ShareContext,
    ShareableKind,
    SnapshotResultOf,
} from '@/entities/shared-analysis';
import type { Bar } from '@y0ngha/siglens-core';

export type ShareableStatus =
    | 'idle'
    | 'pending'
    | 'success'
    | 'error'
    | 'unavailable';

export interface ShareableRegistration<
    K extends ShareableKind = ShareableKind,
> {
    kind: K;
    status: ShareableStatus;
    result: SnapshotResultOf<K> | null;
    context: ShareContext;
    trigger: () => void;
    /**
     * Snapshot-time candlestick bars — chart kind only.
     * Threaded from ChartContent (which has bars in scope via useBars) into the
     * share registration so ShareButton can include them in the snapshot action call.
     */
    chartBars?: Bar[];
    /**
     * 쉽게보기 산문. 위젯이 이미 화면에 갖고 있는 값을 그대로 넘긴다 —
     * 공유 스냅샷에 실어야 링크를 받은 사람도 쉽게보기/원문보기를 쓸 수 있다.
     * 평이화가 실패했거나 아직 안 왔으면 `null`.
     */
    plain?: string | null;
}

interface ShareableContextValue {
    current: ShareableRegistration | null;
    register: (reg: ShareableRegistration | null) => void;
}

const Ctx = createContext<ShareableContextValue | null>(null);

export function ShareableAnalysisProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [current, setCurrent] = useState<ShareableRegistration | null>(null);
    const register = useCallback(
        (reg: ShareableRegistration | null) => setCurrent(reg),
        []
    );
    const value = useMemo(() => ({ current, register }), [current, register]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 헤더 ShareButton이 현재 활성 탭의 등록값을 읽는다. Provider 밖이면 null. */
export function useShareable(): ShareableRegistration | null {
    return useContext(Ctx)?.current ?? null;
}

/**
 * 활성 탭 위젯이 자기 상태를 등록한다. 언마운트 시 해제.
 *
 * Deps are primitive values extracted from reg so no eslint-disable is needed
 * and no object-identity render loop occurs. `trigger` is captured via a ref
 * so the registration effect doesn't re-run when only the callback identity changes.
 *
 * `chartBars` is also captured via a ref: the bars array reference changes every
 * render (useBars returns a new array on each query result), so including it directly
 * as a dep would cause continuous re-registration. The ref always holds the latest
 * bars and is read at registration time, which is triggered by the other primitive
 * deps (status, result, symbol, etc.) that change meaningfully when bars actually
 * update (the analysis result / status transitions accompany a new bars fetch).
 *
 * Intentional design: chartBars-only updates (bars changing but status/result
 * unchanged) do NOT re-trigger registration. This is acceptable for the share flow
 * because (a) bars always change in concert with status/result transitions in
 * practice, and (b) the share snapshot is immutable once created — stale bars at
 * registration time are low-risk and the snapshot captures bars at share-click time
 * via the ref (not at registration time).
 */
export function useRegisterShareable(reg: ShareableRegistration): void {
    const ctx = useContext(Ctx);
    // `register` is a stable useCallback from the Provider — its identity never
    // changes, unlike `ctx` (the memoized value object) which gets a new
    // reference on every setCurrent. Depending on `register` (not `ctx`) is
    // what breaks the re-registration storm.
    const register = ctx?.register;
    // Refs capture the churn-prone values (trigger, chartBars, result) so the
    // registration effect can depend ONLY on stable primitives and never re-run
    // on object-identity changes. Without this, a caller that builds a fresh
    // `result`/`context`/`trigger` each render (e.g. ChartContent) triggers an
    // infinite loop: register → setCurrent → Provider re-render → new object
    // deps → effect re-runs → register → … (heap-exhaustion render storm).
    const triggerRef = useRef(reg.trigger);
    const chartBarsRef = useRef(reg.chartBars);
    const resultRef = useRef(reg.result);
    const { kind, status, context, plain } = reg;
    const { symbol, displayName, assetClass, analyzedAt } = context;
    useEffect(() => {
        triggerRef.current = reg.trigger;
        chartBarsRef.current = reg.chartBars;
        resultRef.current = reg.result;
    });
    useEffect(() => {
        if (!register) return;
        // A genuinely new analysis result always arrives with a new `analyzedAt`
        // and/or a `status` transition (both primitives in the deps below), so
        // reading `result` from the ref at registration time is sufficient — the
        // effect re-runs on those meaningful transitions and picks up the latest
        // result/trigger/chartBars from their refs.
        register({
            kind,
            status,
            result: resultRef.current,
            context: { symbol, displayName, assetClass, analyzedAt },
            trigger: () => triggerRef.current(),
            chartBars: chartBarsRef.current,
            plain,
        });
        return () => register(null);
    }, [
        register,
        kind,
        status,
        symbol,
        displayName,
        assetClass,
        analyzedAt,
        // 문자열(원시값)이라 ref로 우회할 필요가 없다. 평이화는 결과보다 늦게
        // 도착하는 경우가 있어(SSE 봉투가 같이 오지만 위젯 상태 갱신 순서가
        // 다를 수 있다) 이 값이 바뀌면 재등록해야 공유에 산문이 실린다.
        plain,
    ]);
}
