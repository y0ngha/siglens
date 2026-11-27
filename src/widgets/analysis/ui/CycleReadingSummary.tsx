/**
 * 대순환 카드의 구조화된 읽기 — 첫 줄은 단계 제목, 나머지는 사실 한 줄씩.
 */
interface CycleReadingSummaryProps {
    /** `renderCycleReading`의 결과(첫 줄이 제목). */
    lines: readonly string[];
}

export function CycleReadingSummary({ lines }: CycleReadingSummaryProps) {
    const [headline, ...details] = lines;
    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-secondary-300">{headline}</p>
            <ul className="flex flex-col gap-0.5 text-xs text-secondary-400">
                {/* 줄 목록은 렌더마다 같은 순서로 만들어지는 파생 값이라 인덱스가 안정적인 키다. */}
                {details.map((line, index) => (
                    <li key={index}>{line}</li>
                ))}
            </ul>
        </div>
    );
}
