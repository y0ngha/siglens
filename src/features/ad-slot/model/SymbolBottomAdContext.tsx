'use client';

/**
 * `/[symbol]` 레이아웃의 공통 하단 광고(`symbol-bottom`)를 탭 화면이 끌 수 있게 하는 신호.
 *
 * 레이아웃은 탭 본문이 오류 화면인지, 성능 저하 안내인지, 내용이 없는 화면인지 모른다. 그런 화면은
 * `<SuppressSymbolBottomAd />`를 렌더하고, 레이아웃의 `SymbolBottomAd`는 억제 신호가 하나라도
 * 있으면 렌더하지 않는다. AdSense는 내용 없는 화면의 광고를 금지한다.
 *
 * 수(count)와 dispatch를 다른 컨텍스트로 나눈다. 등록하는 쪽은 안정적인 dispatch만 구독하므로
 * 억제 수가 바뀌어도 다시 렌더되지 않고, effect가 다시 돌며 등록·해제를 반복하지 않는다.
 */
import {
    createContext,
    type Dispatch,
    type ReactNode,
    useContext,
    useEffect,
    useReducer,
} from 'react';

type SuppressionDelta = 1 | -1;

const SuppressionCountContext = createContext(0);
const SuppressionDispatchContext =
    createContext<Dispatch<SuppressionDelta> | null>(null);

function countReducer(count: number, delta: SuppressionDelta): number {
    return count + delta;
}

export function SymbolBottomAdProvider({
    children,
}: {
    readonly children: ReactNode;
}) {
    const [count, dispatch] = useReducer(countReducer, 0);
    return (
        <SuppressionDispatchContext value={dispatch}>
            <SuppressionCountContext value={count}>
                {children}
            </SuppressionCountContext>
        </SuppressionDispatchContext>
    );
}

/** 마운트돼 있는 동안 공통 하단 광고를 끈다. Provider 밖에서는 아무 일도 하지 않는다. */
export function SuppressSymbolBottomAd(): null {
    const dispatch = useContext(SuppressionDispatchContext);
    useEffect(() => {
        if (dispatch === null) return;
        dispatch(1);
        return () => dispatch(-1);
    }, [dispatch]);
    return null;
}

export function useSymbolBottomAdSuppressed(): boolean {
    return useContext(SuppressionCountContext) > 0;
}
