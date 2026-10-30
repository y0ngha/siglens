import type React from 'react';
import { cn } from '@/shared/lib/cn';
import {
    CONFIDENCE_BAR_CLASS,
    getConfidenceTier,
} from '../../utils/confidenceTier';

interface ConfidenceBarProps {
    /** 0~1 신뢰도 점수. */
    readonly weight: number;
}

/**
 * 신뢰도 점수 막대 + 퍼센트 수치.
 *
 * 막대는 장식(`aria-hidden`)이고 의미는 옆의 퍼센트 텍스트가 전달한다. 폭은
 * 인라인 width 대신 CSS 변수로 넘겨 Tailwind 유틸이 스타일을 소유하게 한다.
 */
export function ConfidenceBar({ weight }: ConfidenceBarProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary-700">
                <div
                    data-testid="confidence-bar"
                    className={cn(
                        'h-full w-(--confidence-w) rounded-full',
                        CONFIDENCE_BAR_CLASS[getConfidenceTier(weight)]
                    )}
                    style={
                        {
                            '--confidence-w': `${weight * 100}%`,
                        } as React.CSSProperties
                    }
                    aria-hidden="true"
                />
            </div>
            <span className="font-mono text-xs text-secondary-400">
                {Math.round(weight * 100)}%
            </span>
        </div>
    );
}
