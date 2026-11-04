'use client';

import { useTranslations } from 'next-intl';
import {
    type ReactNode,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { BacktestTradeRows } from './BacktestTradeRows';
import { useBacktestTradeRowsByMonth } from './hooks/useBacktestTradeRowsByMonth';
import { useBacktestTradesByKey } from './hooks/useBacktestTradesByKey';
import { TradeDetails } from './ui/trade-row/TradeDetails';
import {
    subscribeLazyMonthOpen,
    subscribeTradeDetailsOpen,
} from './utils/tradeDetailsToggle';

interface TradeDetailsHostProps {
    runId: string;
    children: ReactNode;
}

/** 키(매매 키 또는 월 키) → 본문을 그려 넣을 자리. */
type OpenedSlots = ReadonlyMap<string, HTMLElement>;

type Subscribe = (
    root: HTMLElement,
    onOpen: (key: string, slot: HTMLElement) => void
) => () => void;

/** `subscribe`가 알린 자리를 한 번 열린 뒤로 계속 기억한다. */
function useOpenedSlots(
    rootRef: RefObject<HTMLElement | null>,
    subscribe: Subscribe
): OpenedSlots {
    const [opened, setOpened] = useState<OpenedSlots>(() => new Map());
    useEffect(() => {
        const root = rootRef.current;
        if (root === null) return;
        return subscribe(root, (key, slot) =>
            setOpened(prev =>
                prev.has(key) ? prev : new Map(prev).set(key, slot)
            )
        );
    }, [rootRef, subscribe]);
    return opened;
}

function SlotStatus({ text, className }: { text: string; className: string }) {
    return (
        <p role="status" className={className}>
            {text}
        </p>
    );
}

interface PortalsProps {
    runId: string;
    rootRef: RefObject<HTMLElement | null>;
}

/** 열린 매매 행의 상세 자리(`data-trade-detail`)에 상세를 그린다. */
function TradeDetailPortals({ runId, rootRef }: PortalsProps) {
    const t = useTranslations('widgets.backtesting.tradeRow');
    const opened = useOpenedSlots(rootRef, subscribeTradeDetailsOpen);
    const { data: tradesByKey, isError } = useBacktestTradesByKey(
        runId,
        opened.size > 0
    );

    return Array.from(opened, ([key, slot]) => {
        const trade = tradesByKey?.get(key);
        const body =
            trade !== undefined ? (
                <TradeDetails trade={trade} />
            ) : (
                <SlotStatus
                    className="border-t border-secondary-700/60 px-3 py-3 text-xs text-secondary-500"
                    text={
                        isError || tradesByKey !== undefined
                            ? t('loadError')
                            : t('loading')
                    }
                />
            );
        return createPortal(body, slot, key);
    });
}

/** 열린 옛 월의 자리(`data-lazy-month`)에 그 달의 매매 행을 그린다. */
function LazyMonthPortals({ runId, rootRef }: PortalsProps) {
    const t = useTranslations('widgets.backtesting.tradeList');
    const opened = useOpenedSlots(rootRef, subscribeLazyMonthOpen);
    const { data: rowsByMonth, isError } = useBacktestTradeRowsByMonth(
        runId,
        opened.size > 0
    );

    return Array.from(opened, ([monthKey, slot]) => {
        const rows = rowsByMonth?.get(monthKey);
        const body =
            rows !== undefined ? (
                <BacktestTradeRows rows={rows} />
            ) : (
                <SlotStatus
                    className="px-3 py-2 text-xs text-secondary-500"
                    text={
                        isError || rowsByMonth !== undefined
                            ? t('monthLoadError')
                            : t('monthLoading')
                    }
                />
            );
        return createPortal(body, slot, monthKey);
    });
}

/**
 * 펼칠 때 그려 넣는 호스트. 서버 HTML에는 최근 월의 접힌 줄과 빈 자리표시자만 있다 — 690행의
 * 상세를 미리 그리면 HTML과 RSC 페이로드가 4MB를 넘었고, 상세를 뺀 접힌 줄만으로도 1.2MB였다.
 * 행마다 클라이언트 컴포넌트를 두지 않고 `toggle`을 받아 포털로 그린다.
 *
 * - 행을 아직 그리지 않은 월 섹션이 열리면 그 달의 행을 월 자리(`data-lazy-month`)에 그린다.
 *   종목 탭은 월을 전부 펼치므로 그때 모든 월의 행이 그려진다.
 * - 매매 행이 열리면 상세를 행 자리(`data-trade-detail`)에 그린다. 월 자리에 그린 행도 같은
 *   `toggle`로 잡힌다.
 *
 * 두 종류는 상태를 따로 가진 컴포넌트로 나눴다 — 상세 하나를 열 때마다 이미 그린 월의 행 전체가
 * 다시 조정되지 않게. 데이터는 처음 열 때 공개 정적 파일에서 한 번만 불러온다.
 */
export function TradeDetailsHost({ runId, children }: TradeDetailsHostProps) {
    const rootRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={rootRef}>
            {children}
            <LazyMonthPortals runId={runId} rootRef={rootRef} />
            <TradeDetailPortals runId={runId} rootRef={rootRef} />
        </div>
    );
}
