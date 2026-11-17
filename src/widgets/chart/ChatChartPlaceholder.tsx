import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** 답변 안 차트(`ChatChart`)의 틀 — 카드 표면에 높이를 고정해 차트가 들어와도 레이아웃이 밀리지 않는다. */
export const CHAT_CHART_FRAME_CLASS = cn(
    SURFACE_CARD,
    'my-3 h-72 w-full overflow-hidden sm:h-80'
);

/** 답변 안 차트가 내려오는 동안의 자리 — 차트와 같은 틀이다. */
export function ChatChartPlaceholder() {
    return (
        <div
            aria-hidden="true"
            className={cn(CHAT_CHART_FRAME_CLASS, 'animate-pulse')}
        />
    );
}
