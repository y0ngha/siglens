/**
 * 뉴스 카드 한 장 분량의 로딩 자리 표시.
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { NewsBodySkeleton } from './NewsBodySkeleton';

/** 장식 전용이라 통째로 `aria-hidden`이다. */
export function NewsCardSkeleton() {
    return (
        <article aria-hidden="true" className={cn(SURFACE_CARD, 'p-4')}>
            <div className="h-5 w-4/5 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="h-5 w-10 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-5 w-24 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
                <div className="h-4 w-20 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            </div>
            <NewsBodySkeleton />
        </article>
    );
}
