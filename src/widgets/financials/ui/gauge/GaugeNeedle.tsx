/**
 * 게이지 바늘과 중심 피벗.
 */
import {
    GAUGE_CENTER,
    NEEDLE_PIVOT_RADIUS,
    needlePoints,
    needleRotationDeg,
} from '../../utils/gaugeGeometry';

interface GaugeNeedleProps {
    /** 종합 점수. `null`이면 0점 위치에 둔다. */
    score: number | null;
}

/** 점수 각도로 회전한 삼각형 바늘. */
export function GaugeNeedle({ score }: GaugeNeedleProps) {
    return (
        <>
            <g
                transform={`rotate(${needleRotationDeg(score)} ${GAUGE_CENTER.x} ${GAUGE_CENTER.y})`}
            >
                <polygon
                    points={needlePoints()}
                    className="fill-secondary-100"
                />
            </g>
            <circle
                cx={GAUGE_CENTER.x}
                cy={GAUGE_CENTER.y}
                r={NEEDLE_PIVOT_RADIUS}
                className="fill-secondary-100"
            />
        </>
    );
}
