import { cn } from '@/shared/lib/cn';

/** 막대 하나 — `value`는 부호가 방향이다(양수는 기준선 위, 음수는 아래). `null`은 그리지 않는다. */
export interface ColumnBar {
    /** 계열 이름 — 그룹 안에서 유일한 키다. */
    id: string;
    value: number | null;
    /** 채움색 유틸리티(`bg-…`) — 알파를 얹지 않는다(그래픽 대비 가드). */
    fillClass: string;
}

export interface ColumnGroup {
    key: string;
    /** x축 눈금 글자. 비우면 눈금을 그리지 않는다(촘촘한 열에서 일부만 보인다). */
    label: string;
    /** 마우스를 올렸을 때의 풀이(`title`) — 정확한 값은 접힌 표가 준다. */
    title: string;
    bars: readonly ColumnBar[];
}

interface BarColumnsProps {
    groups: readonly ColumnGroup[];
    /** 값 축 최댓값·최솟값 글자(값 → 글자). 주지 않으면 눈금 글자를 그리지 않는다. */
    formatAxis?: (value: number) => string;
}

/**
 * 막대 열 차트의 기본 틀 — 시그렌즈에 대응 뷰가 없는 새 그림(국내 수급·내부자 월별)이 이것으로 막대를 그린다. 기준선(0)은 값의 범위로
 * 정해지고(음수가 없으면 아래쪽), 막대는 절대 위치라 값마다 높이만 바뀐다. 글자가 칸 폭에 묶이지 않게 SVG가 아니라
 * CSS로 그렸다(뷰박스 축소로 글자가 작아지는 것을 피한다). 그래픽이라 `aria-hidden`이고, 같은 수치는 접힌 데이터 표가 준다.
 */
export function BarColumns({ groups, formatAxis }: BarColumnsProps) {
    const values = groups.flatMap(g =>
        g.bars.flatMap(b => (b.value === null ? [] : [b.value]))
    );
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const range = max - min || 1;
    const zeroTopPct = (max / range) * 100;
    return (
        <div className="flex h-full min-h-0 flex-col" aria-hidden="true">
            <div className="relative min-h-0 flex-1">
                <div
                    className="absolute inset-x-0 border-t border-secondary-600"
                    style={{ top: `${zeroTopPct}%` }}
                />
                {formatAxis === undefined ? null : (
                    <>
                        <span className="absolute top-0 left-0 text-[10px] text-secondary-400">
                            {formatAxis(max)}
                        </span>
                        {min < 0 ? (
                            <span className="absolute bottom-0 left-0 text-[10px] text-secondary-400">
                                {formatAxis(min)}
                            </span>
                        ) : null}
                    </>
                )}
                <div className="absolute inset-0 flex gap-0.5">
                    {groups.map(g => (
                        <div
                            key={g.key}
                            title={g.title}
                            className="relative h-full min-w-0 flex-1"
                        >
                            {g.bars.map((bar, i) =>
                                bar.value === null ? null : (
                                    <div
                                        key={bar.id}
                                        className={cn(
                                            'absolute rounded-sm',
                                            bar.fillClass
                                        )}
                                        style={{
                                            top: `${((max - Math.max(bar.value, 0)) / range) * 100}%`,
                                            height: `${(Math.abs(bar.value) / range) * 100}%`,
                                            minHeight:
                                                bar.value === 0 ? 0 : '1px',
                                            left: `${(i / g.bars.length) * 100}%`,
                                            width: `${100 / g.bars.length}%`,
                                        }}
                                    />
                                )
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-1 flex gap-0.5 text-[10px] text-secondary-400">
                {groups.map(g => (
                    <span
                        key={g.key}
                        className="min-w-0 flex-1 truncate text-center"
                    >
                        {g.label}
                    </span>
                ))}
            </div>
        </div>
    );
}
