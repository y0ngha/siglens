import { cn } from '@/shared/lib/cn';

interface MarketDataErrorNoticeProps {
    /**
     * 어느 시장인가 — `DashboardScope.marketLabel`.
     *
     * 문구를 `'미국 증시'`로 박아 두면 `/market/kr`이 한국 데이터가 빈 상황에서
     * 미국 얘기를 한다. 하필 **부분 실패가 예상되는 쪽이 한국**이다
     * (`marketSummaryCache`의 `shouldCacheSummary` 주석 — KR 섹터 ETF는 얇아서
     * 하나가 간헐적으로 빈다). `$`를 원화 종목에 붙였던 것과 같은 결함이다.
     */
    marketLabel: string;
    /**
     * 얼마나 실패했나.
     *
     * `'partial'`은 시세 일부만 빈 경우, `'total'`은 요약 자체가 없어 카드도 제목도
     * 못 그리는 경우다. 문구를 하나로 두면 아무것도 못 불러온 화면이 "일부를
     * 가져오지 못했어요"라고 말한다 — 화면 상태와 어긋나는 안내다.
     */
    variant: 'partial' | 'total';
    /** 'x' 클릭 시 호출 — 닫기 상태는 소비자(패널)가 소유한다. */
    onClose: () => void;
    className?: string;
}

/**
 * 시장 요약 데이터의 일부(또는 전부)를 가져오지 못했을 때 시장 페이지 상단에
 * 노출하는 안내. transient 장애(레이트리밋 등)라 새로고침으로 회복 가능하므로
 * 위험(`ui-danger`)이 아닌 경고(`ui-warning`) 톤을 쓴다. 닫기 가능하지만 닫음 상태는
 * 일시적이며(소비자의 useState), 새로고침/재조회 후에도 실패가 지속되면 다시 뜬다.
 */
export function MarketDataErrorNotice({
    marketLabel,
    variant,
    onClose,
    className,
}: MarketDataErrorNoticeProps) {
    return (
        <div
            role="alert"
            className={cn(
                'border-ui-warning/30 bg-ui-warning/5 text-ui-warning-text flex items-start gap-2 rounded-lg border p-3 text-sm',
                className
            )}
        >
            <span aria-hidden>⚠</span>
            <div className="flex-1 space-y-0.5">
                <p>
                    {variant === 'total'
                        ? `${marketLabel} 데이터를 불러오지 못했어요.`
                        : `${marketLabel} 데이터를 불러오는 중 일부를 가져오지 못했어요.`}
                </p>
                <p className="text-ui-warning-text/90">
                    잠시 후 새로고침해 다시 시도해 주세요.
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="안내 닫기"
                className="-m-1 shrink-0 rounded p-1 leading-none text-ui-warning-text transition-colors hover:text-ui-warning-text focus-visible:ring-2 focus-visible:ring-ui-warning/50 focus-visible:outline-none"
            >
                ✕
            </button>
        </div>
    );
}
