'use client';

import { useEffect } from 'react';
import { useRecentSymbols } from '../hooks/useRecentSymbols';

interface RecordRecentSymbolProps {
    symbol: string;
    /** 표시명(회사명). 모르면 심볼. */
    label: string;
}

/**
 * 종목 페이지에 들어왔다는 사실을 "최근 본 종목"에 남긴다. 아무것도 그리지 않는다.
 * 같은 종목 안에서 탭을 옮겨도 `symbol`·`label`이 같으면 다시 기록하지 않는다.
 */
export function RecordRecentSymbol({ symbol, label }: RecordRecentSymbolProps) {
    const { record } = useRecentSymbols();
    useEffect(() => {
        record({ symbol, label });
    }, [record, symbol, label]);
    return null;
}
