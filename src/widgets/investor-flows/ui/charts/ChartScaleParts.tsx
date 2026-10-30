/**
 * 선·막대 그래프가 공유하는 곁가지 — 왼쪽 눈금 열과 아래 양끝 라벨.
 */

/** 그래프 영역 높이와 맞춘 왼쪽 눈금 열(위·아래 라벨). 장식이라 스크린리더에서 숨긴다. */
export function ScaleTicks({
    top,
    bottom,
}: {
    readonly top: string;
    readonly bottom: string;
}) {
    return (
        <div
            aria-hidden="true"
            className="flex h-32 w-14 shrink-0 flex-col justify-between text-right text-xs text-secondary-400 tabular-nums"
        >
            <span>{top}</span>
            <span>{bottom}</span>
        </div>
    );
}

/** 가로축 양끝 라벨. 눈금 열 너비(`pl-16`)만큼 안쪽에서 시작해 그래프 상자와 줄을 맞춘다. */
export function AxisEndLabels({
    start,
    end,
}: {
    readonly start: string;
    readonly end: string;
}) {
    return (
        <div
            aria-hidden="true"
            className="mt-1 flex justify-between pl-16 font-mono text-xs text-secondary-400 tabular-nums"
        >
            <span>{start}</span>
            <span>{end}</span>
        </div>
    );
}
