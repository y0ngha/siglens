import { cn } from '@/shared/lib/cn';

interface MarketDataErrorNoticeProps {
    /** 'x' 클릭 시 호출 — 닫기 상태는 소비자(패널)가 소유한다. */
    onClose: () => void;
    className?: string;
}

/**
 * 시장 요약 데이터의 일부(또는 전부)를 FMP에서 가져오지 못했을 때 `/market` 상단에
 * 노출하는 안내. transient 장애(레이트리밋 등)라 새로고침으로 회복 가능하므로
 * 위험(`ui-danger`)이 아닌 경고(`ui-warning`) 톤을 쓴다. 닫기 가능하지만 닫음 상태는
 * 일시적이며(소비자의 useState), 새로고침/재조회 후에도 실패가 지속되면 다시 뜬다.
 */
export function MarketDataErrorNotice({
    onClose,
    className,
}: MarketDataErrorNoticeProps) {
    return (
        <div
            role="alert"
            className={cn(
                'border-ui-warning/30 bg-ui-warning/5 text-ui-warning flex items-start gap-2 rounded-md border p-3 text-sm',
                className
            )}
        >
            <span aria-hidden>⚠</span>
            <div className="flex-1 space-y-0.5">
                <p>미국 증시 데이터를 불러오는 중 일부를 가져오지 못했어요.</p>
                <p className="text-ui-warning/80">
                    잠시 후 새로고침해 다시 시도해 주세요.
                </p>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="안내 닫기"
                className="text-ui-warning/70 hover:text-ui-warning focus-visible:ring-ui-warning/50 -m-1 shrink-0 rounded p-1 leading-none transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                ✕
            </button>
        </div>
    );
}
