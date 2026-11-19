import { cn } from '@/shared/lib/cn';
import { CHAT_CHART_FRAME_CLASS } from '../ChatChartPlaceholder';

/** 접힌 데이터 표 줄의 높이 — 블록(`VisualBlockFrame`)과 이 자리 표시가 같은 값을 쓴다. */
export const VISUAL_TABLE_ROW_CLASS = 'h-8';

/**
 * 시각화 블록이 내려오는 동안의 자리 — 카드와 접힌 표 줄까지 같은 높이라 블록이 들어와도 아래 글이 밀리지 않는다.
 */
export function ChatVisualPlaceholder() {
    return (
        <div aria-hidden="true" className="my-3">
            <div className={cn(CHAT_CHART_FRAME_CLASS, 'my-0 animate-pulse')} />
            <div className={VISUAL_TABLE_ROW_CLASS} />
        </div>
    );
}
