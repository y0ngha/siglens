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
 */
export function useRegisterShareable(reg: ShareableRegistration): void {
    const ctx = useContext(Ctx);
    const { kind, status, result, context, trigger } = reg;
    const { symbol, displayName, assetClass, analyzedAt } = context;
    const triggerRef = useRef(trigger);
    useEffect(() => {
        triggerRef.current = trigger;
    });
    useEffect(() => {
        ctx?.register({
            kind,
            status,
            result,
            context: { symbol, displayName, assetClass, analyzedAt },
            trigger: () => triggerRef.current(),
        });
        return () => ctx?.register(null);
    }, [
        ctx,
        kind,
        status,
        result,
        symbol,
        displayName,
        assetClass,
        analyzedAt,
    ]);
}
