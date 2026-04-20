interface RovingNavOptions {
    withHomeEnd?: boolean;
}

// Arrow L/R (기본) + Home/End (옵션)로 주어진 리스트 내 다음 인덱스를 계산한다.
// 처리 대상이 아닌 key에는 null을 반환한다 (caller는 e.preventDefault()를 건너뛸 수 있다).
export function getRovingNextIndex(
    key: string,
    currentIdx: number,
    total: number,
    { withHomeEnd = true }: RovingNavOptions = {}
): number | null {
    if (key === 'ArrowRight') return (currentIdx + 1) % total;
    if (key === 'ArrowLeft') return (currentIdx - 1 + total) % total;
    if (withHomeEnd && key === 'Home') return 0;
    if (withHomeEnd && key === 'End') return total - 1;
    return null;
}
