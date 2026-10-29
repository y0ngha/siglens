import { cn } from '@/shared/lib/cn';
import {
    DEMO_CHART_FONT,
    labelTextX,
    type OverlayLabel,
} from '@/views/guide/lib/demoChartLayout';
import {
    LABEL_HALO,
    overlayLabelClass,
} from '@/views/guide/ui/guideChartStyles';

interface DemoTextLabelProps {
    readonly label: OverlayLabel;
}

/**
 * `layoutOverlayLabels`가 정한 상자 그대로 그리고 자리는 여기서 다시 계산하지 않는다 — 라벨끼리·봉과
 * 겹치지 않게 비키는 판단은 모든 라벨 상자를 아는 레이아웃만 할 수 있다. 그래도 선·띠와는 겹칠 수 있어
 * 글자 뒤에 카드 배경색 테두리(halo, `paintOrder="stroke"`)를 둘러 읽히게 한다.
 */
export function DemoTextLabel({ label }: DemoTextLabelProps) {
    return (
        <text
            className={cn(overlayLabelClass(label.colour), LABEL_HALO)}
            dominantBaseline="central"
            fontSize={DEMO_CHART_FONT}
            fontWeight={600}
            textAnchor={label.anchor}
            x={labelTextX(label.box, label.anchor)}
            y={label.box.y + label.box.height / 2}
            paintOrder="stroke"
            strokeLinejoin="round"
            strokeWidth={3}
        >
            {label.text}
        </text>
    );
}
