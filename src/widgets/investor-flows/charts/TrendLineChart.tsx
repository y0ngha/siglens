import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { buildLineGeometry, segmentToPath } from '../utils/linePath';

interface TrendLineChartProps {
    /** 오래된 → 최신. `null`은 선을 끊는다. */
    readonly values: readonly (number | null)[];
    /** 점선 평균선의 값(같은 단위). 없으면 평균선을 그리지 않는다. */
    readonly average?: number | null;
    /** 스크린리더용 한 줄 요약(그래프 자체는 `role="img"`로 이름만 읽힌다). */
    readonly ariaLabel: string;
    /** 위/아래 눈금 라벨(이미 포맷된 문자열). */
    readonly maxLabel: string;
    readonly minLabel: string;
    /** 가로축 양끝 라벨. */
    readonly startLabel: string;
    readonly endLabel: string;
    /** 선 색 클래스. 기본은 `stroke-primary-400`. */
    readonly lineClassName?: string;
    /** 끝점 표식 색 클래스. */
    readonly dotClassName?: string;
}

/**
 * 가벼운 선 그래프 — inline SVG(`GrowthChart`·`FearGreedGauge`와 같은 방식, 차트 라이브러리 없음).
 *
 * `viewBox` 0~100 + `preserveAspectRatio="none"`로 어떤 폭에서도 채우되, 늘어남으로 선이 굵어지지 않게
 * `vector-effect: non-scaling-stroke`(`[vector-effect:non-scaling-stroke]`)를 쓴다. 끝점 표식은 SVG가 늘어나며
 * 타원이 되지 않도록 HTML 점으로 얹는다(좌표는 CSS 변수 — TW-1). 눈금·양끝 라벨도 HTML이라 글자 크기가
 * 폭에 따라 변하지 않는다. 높이가 고정이라 데이터가 바뀌어도 레이아웃이 움직이지 않는다.
 */
export function TrendLineChart({
    values,
    average = null,
    ariaLabel,
    maxLabel,
    minLabel,
    startLabel,
    endLabel,
    lineClassName = 'stroke-primary-400',
    dotClassName = 'bg-primary-400',
}: TrendLineChartProps) {
    const geometry = buildLineGeometry(values, average);
    if (geometry === null) return null;
    // 안전한 캐스트: 값은 이 파일이 만든 `%` 문자열(숫자 + `%`)뿐이라 CSS 변수 두 개 외에는 담지 않는다.
    const dotStyle =
        geometry.last === null
            ? undefined
            : ({
                  '--dot-x': `${geometry.last.x}%`,
                  '--dot-y': `${geometry.last.y}%`,
              } as CSSProperties);
    return (
        <div>
            <div className="flex gap-2">
                <div
                    aria-hidden="true"
                    className="flex h-32 w-14 shrink-0 flex-col justify-between text-right text-xs text-secondary-400 tabular-nums"
                >
                    <span>{maxLabel}</span>
                    <span>{minLabel}</span>
                </div>
                <div
                    role="img"
                    aria-label={ariaLabel}
                    className="relative h-32 min-w-0 flex-1 rounded border border-secondary-700"
                >
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="absolute inset-0 size-full"
                    >
                        {geometry.averageY !== null && (
                            <line
                                x1="0"
                                x2="100"
                                y1={geometry.averageY}
                                y2={geometry.averageY}
                                className="stroke-secondary-400 [vector-effect:non-scaling-stroke]"
                                strokeWidth="1"
                                strokeDasharray="4 3"
                            />
                        )}
                        {geometry.segments.map(points =>
                            points.length > 1 ? (
                                <path
                                    key={`${points[0].x}-${points[0].y}`}
                                    d={segmentToPath(points)}
                                    fill="none"
                                    className={cn(
                                        lineClassName,
                                        '[vector-effect:non-scaling-stroke]'
                                    )}
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                            ) : null
                        )}
                    </svg>
                    {dotStyle !== undefined && (
                        <span
                            aria-hidden="true"
                            style={dotStyle}
                            className={cn(
                                'absolute top-(--dot-y) left-(--dot-x) size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
                                dotClassName
                            )}
                        />
                    )}
                </div>
            </div>
            <div
                aria-hidden="true"
                className="mt-1 flex justify-between pl-16 font-mono text-xs text-secondary-400 tabular-nums"
            >
                <span>{startLabel}</span>
                <span>{endLabel}</span>
            </div>
        </div>
    );
}
