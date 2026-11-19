import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

interface VisualBlockCardProps {
    title: string;
    /** 기준 시각 글자(이미 서식을 입힌 한 줄). */
    asOfText: string;
    /**
     * `card`(기본)는 카드 표면을 두르고, `bare`는 표면 없이 제목 줄만 둔다 — 재사용하는 위젯이 이미 자기 카드를
     * 가질 때(옵션 미결제약정) 카드 안에 카드가 들어가지 않게 한다.
     */
    variant?: 'card' | 'bare';
    children: ReactNode;
}

/**
 * 시각화 블록 중 **높이가 내용만큼인** 것(시그렌즈 위젯을 재사용한 블록과 표 블록)의 틀 — 제목과 기준 시각 줄 아래에
 * 내용을 놓는다. 그림이 고정 높이인 새 그림은 `VisualBlockFrame`을 쓴다. 블록은 답변 끝에 붙으므로 높이가 내용을
 * 따라도 읽던 글을 밀지 않는다. 스크린 리더용 요약(`role="img"`)이나 표 캡션은 내용을 만드는 쪽이 단다 — 표를
 * `role="img"`로 감싸면 표 구조가 사라진다.
 */
export function VisualBlockCard({
    title,
    asOfText,
    variant = 'card',
    children,
}: VisualBlockCardProps) {
    return (
        <figure
            data-testid="chat-visual-block"
            className={cn('my-3', variant === 'card' && [SURFACE_CARD, 'p-3'])}
        >
            <figcaption
                className={cn(
                    'flex items-baseline justify-between gap-2',
                    variant === 'card' ? 'mb-2' : 'mb-1 px-1'
                )}
            >
                <span className="truncate text-xs font-medium text-secondary-200">
                    {title}
                </span>
                <span className="shrink-0 text-[10px] text-secondary-400">
                    {asOfText}
                </span>
            </figcaption>
            {children}
        </figure>
    );
}
