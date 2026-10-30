/**
 * 섹터 신호 소절 자리 표시 — 스켈레톤과 조회 중 화면이 같은 틀을 쓴다.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    PLACEHOLDER_CARD_COUNT,
    SIGNAL_CARD_GRID_CLASS,
} from '../../utils/signalCardGrid';
import { SUBSECTION_IDS } from '../../utils/sectorSignalStocks';

const SECTION_SLOTS = SUBSECTION_IDS;
const CARD_SLOTS = Array.from(
    { length: PLACEHOLDER_CARD_COUNT },
    (_, index) => index
);

/**
 * 소절 머리줄 + 카드 그리드를 흉내 낸 펄스 블록. 의미 없는 장식이라 `aria-hidden`이며,
 * 호출부가 `aria-busy`와 안내 문구를 책임진다. 소절 수와 카드 그리드 열 구성은 실제 패널과
 * 같은 출처(`SUBSECTION_IDS`, `SIGNAL_CARD_GRID_CLASS`)에서 온다.
 */
export function SubsectionPlaceholders() {
    return (
        <div className="flex flex-col gap-4" aria-hidden="true">
            {SECTION_SLOTS.map(section => (
                <div
                    key={section}
                    className="flex flex-col gap-3 border-t border-secondary-700 pt-3 pb-4"
                >
                    <div className="flex items-center justify-between">
                        <div className="h-3 w-20 animate-pulse rounded bg-secondary-700/50" />
                        <div className="h-6 w-8 animate-pulse rounded bg-secondary-700/50" />
                    </div>
                    <div className={SIGNAL_CARD_GRID_CLASS}>
                        {CARD_SLOTS.map(card => (
                            <div
                                key={card}
                                className={cn(
                                    SURFACE_CARD,
                                    'h-[120px] animate-pulse'
                                )}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
