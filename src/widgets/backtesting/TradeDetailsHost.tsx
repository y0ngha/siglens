'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBacktestTradesByKey } from './hooks/useBacktestTradesByKey';
import { TradeDetails } from './ui/trade-row/TradeDetails';
import { subscribeTradeDetailsOpen } from './utils/tradeDetailsToggle';

interface TradeDetailsHostProps {
    runId: string;
    children: ReactNode;
}

type OpenedRows = ReadonlyMap<string, HTMLElement>;

function DetailFallback({ text }: { text: string }) {
    return (
        <p
            role="status"
            className="border-t border-secondary-700/60 px-3 py-3 text-xs text-secondary-500"
        >
            {text}
        </p>
    );
}

/**
 * 매매 행 상세를 펼칠 때 그려 넣는 호스트. 서버 HTML에는 접힌 줄과 빈 자리표시자만 있다 — 690행의
 * 상세를 미리 그리면 HTML과 RSC 페이로드가 4MB를 넘었다. 행마다 클라이언트 컴포넌트를 두지 않고
 * 이 호스트 하나가 `toggle`을 받아, 한 번 열린 행의 자리표시자에 포털로 상세를 그린다. 데이터는
 * 처음 열 때 공개 정적 파일에서 한 번만 불러온다.
 */
export function TradeDetailsHost({ runId, children }: TradeDetailsHostProps) {
    const t = useTranslations('widgets.backtesting.tradeRow');
    const rootRef = useRef<HTMLDivElement>(null);
    const [opened, setOpened] = useState<OpenedRows>(() => new Map());
    const { data: tradesByKey, isError } = useBacktestTradesByKey(
        runId,
        opened.size > 0
    );

    useEffect(() => {
        const root = rootRef.current;
        if (root === null) return;
        return subscribeTradeDetailsOpen(root, (key, placeholder) => {
            setOpened(prev =>
                prev.has(key) ? prev : new Map(prev).set(key, placeholder)
            );
        });
    }, []);

    return (
        <div ref={rootRef}>
            {children}
            {Array.from(opened, ([key, placeholder]) => {
                const trade = tradesByKey?.get(key);
                const body =
                    trade !== undefined ? (
                        <TradeDetails trade={trade} />
                    ) : (
                        <DetailFallback
                            text={
                                isError || tradesByKey !== undefined
                                    ? t('loadError')
                                    : t('loading')
                            }
                        />
                    );
                return createPortal(body, placeholder, key);
            })}
        </div>
    );
}
