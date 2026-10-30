/**
 * 보강 대기 중인 카드의 요약 자리표시자.
 */

/** aria-hidden=true — 스크린리더는 본문 로딩 중 스켈레톤 줄을 읽지 않는다. */
export function SummarySkeletonLine() {
    return (
        <div aria-hidden="true" className="mt-2 space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
        </div>
    );
}
