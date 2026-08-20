import { cn } from '@/shared/lib/cn';
import type { BadgeTone, MarketBadgeSpec } from '../lib/resultDisplay';

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
    crypto: 'bg-primary-900/40 text-primary-300',
    kr: 'bg-primary-800/40 text-primary-200',
    us: 'bg-secondary-700/60 text-secondary-300',
};

/**
 * `self-center`가 핵심이다. 데스크톱 자동완성 행(`TickerAutocomplete`의 `ResultItem`)은
 * `items-baseline`인데 — 종목명과 티커의 글자 밑선을 맞추기 위한 것이다 — 정렬을
 * 상속받으면 배지의 **글자** 밑선이 행 밑선에 맞춰지고, 위아래 패딩만큼 배지 상자가
 * 아래로 내려가 미세하게 어긋난다. 배지는 상자로 읽히는 요소라 상자의 세로 중앙이
 * 맞아야 한다. 오버레이 행(`SearchResultRow`)은 `items-center`라 영향이 없지만,
 * 두 소비자가 같은 컴포넌트를 쓰므로 정렬을 자기 안에서 고정해 둔다.
 */
export function MarketBadge({ label, tone }: MarketBadgeSpec) {
    return (
        <span
            data-testid="market-badge"
            className={cn(
                'shrink-0 self-center rounded px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold',
                BADGE_TONE_CLASS[tone]
            )}
        >
            {label}
        </span>
    );
}
