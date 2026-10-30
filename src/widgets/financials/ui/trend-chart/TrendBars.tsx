/**
 * 추세 차트의 막대 레이어 — 호버 중인 기간 외의 막대는 흐리게 낮춘다.
 */
import { cn } from '@/shared/lib/cn';
import { seriesColorClasses } from '../../utils/trendChartColors';
import type { TrendBar } from '../../utils/trendChartGeometry';

/** 호버 중이 아닌 기간 막대의 투명도 클래스. */
const DIMMED_BAR_CLASS = 'opacity-60';

interface TrendBarsProps {
    bars: TrendBar[];
    /** 호버 중인 기간 index. 없으면 `null`이고 모든 막대가 같은 농도다. */
    activePeriodIdx: number | null;
}

/**
 * 막대 사각형들. 채움이 이미 `/85`라 흐림을 더 낮추면 비활성 기간이 사실상 사라진다.
 * `opacity-60`(실효 알파 0.51)에서 멈추는 이유: 알파만 올려서는 흰 카드 위 상승 막대가
 * 그래픽 기준(3:1)을 넘지 못하고(0.80이 2.76:1, 0.90부터 3.19:1), 0.90은 강조된 막대(0.85)와
 * 구분이 안 돼 호버 대비가 사라진다. 기준을 넘기려면 채도를 낮추거나 강조 쪽에 표시를 더해야 한다.
 */
export function TrendBars({ bars, activePeriodIdx }: TrendBarsProps) {
    return (
        <>
            {bars.map(bar => (
                <rect
                    key={bar.key}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    rx="1"
                    className={cn(
                        seriesColorClasses(bar.color).fill,
                        activePeriodIdx !== null &&
                            activePeriodIdx !== bar.periodIdx &&
                            DIMMED_BAR_CLASS
                    )}
                />
            ))}
        </>
    );
}
