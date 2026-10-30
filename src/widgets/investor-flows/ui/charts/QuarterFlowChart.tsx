/**
 * 분기별 기관 순매수(IN, 위로)·순매도(OUT, 아래로) 막대 — inline SVG.
 */
import { useTranslations } from 'next-intl';
import type { QuarterBar } from '../../utils/institutional';
import { maxAbsNetChange } from '../../utils/quarterBarGeometry';
import { QuarterFlowColumn } from './QuarterFlowColumn';

interface QuarterFlowChartProps {
    readonly bars: readonly QuarterBar[];
}

/**
 * 방향을 **색 + 막대 방향 + 부호 + 글자(IN/OUT)** 네 겹으로 전한다. 진행 중인 분기는 윤곽선만 그려 "아직 덜 모인 값"임을 보이고
 * "부분 집계" 글자를 붙인다.
 */
export function QuarterFlowChart({ bars }: QuarterFlowChartProps) {
    const t = useTranslations('widgets.investor-flows');
    const maxAbs = maxAbsNetChange(bars);
    return (
        <ol
            className="grid auto-cols-fr grid-flow-col items-end gap-1 sm:gap-2"
            aria-label={t('flowChart.title')}
        >
            {bars.map(bar => (
                <QuarterFlowColumn key={bar.period} bar={bar} maxAbs={maxAbs} />
            ))}
        </ol>
    );
}
