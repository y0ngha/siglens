/**
 * 종목 카드의 신호 배지 줄 — 배지 사이를 구분선으로 나눈다.
 */
import type { Signal } from '@y0ngha/siglens-core';
import { SignalBadge } from './SignalBadge';

interface SignalBadgeListProps {
    signals: readonly Signal[];
}

/** 신호가 없으면 줄을 그리지 않는다. 구분선은 장식이라 스크린리더에서 숨긴다. */
export function SignalBadgeList({ signals }: SignalBadgeListProps) {
    if (signals.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
            {signals.map((signal, index) => (
                <span key={signal.type} className="contents">
                    {index > 0 && (
                        <span className="text-secondary-500" aria-hidden="true">
                            |
                        </span>
                    )}
                    <SignalBadge type={signal.type} />
                </span>
            ))}
        </div>
    );
}
