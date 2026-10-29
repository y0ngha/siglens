/** 데모 차트 오버레이 라벨 한 개 — 봉과 겹쳐도 읽히게 카드 배경색 테두리(halo)를 두른다. */
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

/** `layoutOverlayLabels`가 자리를 정한 라벨을 그린다. */
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
