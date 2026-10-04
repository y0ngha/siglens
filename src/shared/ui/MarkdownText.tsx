import type { ComponentPropsWithoutRef } from 'react';
import type { Components } from 'react-markdown';
import { lazy, Suspense } from 'react';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';
import { cn } from '@/shared/lib/cn';

/**
 * 마크다운 렌더러는 지연 로드한다(`MarkdownRenderer` JSDoc). 렌더러가 오기 전에는 같은
 * 글자를 마커만 걷어낸 평문으로 보여 준다 — 빈칸으로 두면 렌더러가 도착할 때 아래 내용이
 * 밀린다. 마크다운을 쓰는 화면은 대부분 클라이언트 전용 경계(`useSearchParams`) 안이라
 * 서버 HTML과 무관하다. 서버에서도 렌더되는 공유 페이지(noindex)에서는 이 경계가 평문
 * fallback으로 먼저 나가고, 렌더러가 도착하면 문단·목록으로 바뀌며 높이가 조금 달라질 수 있다.
 */
const MarkdownRenderer = lazy(() =>
    import('./MarkdownRenderer').then(m => ({ default: m.MarkdownRenderer }))
);

interface MarkdownTextProps extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {
    children: string;
    components?: Components;
}

export function MarkdownText({
    children,
    className,
    components,
    ...props
}: MarkdownTextProps) {
    return (
        <div
            className={cn('leading-[1.75] tracking-normal', className)}
            {...props}
        >
            <Suspense
                fallback={
                    <p className="whitespace-pre-line">
                        {stripSnapshotMarkdown(children)}
                    </p>
                }
            >
                <MarkdownRenderer components={components}>
                    {children}
                </MarkdownRenderer>
            </Suspense>
        </div>
    );
}
