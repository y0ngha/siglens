/**
 * 게이지의 5구간 등급 호.
 */
import {
    GAUGE_STROKE_WIDTH,
    SEGMENTS,
    segmentArcPath,
} from '../../utils/gaugeGeometry';

/** 구간마다 등급 색 호를 하나씩 그린다. */
export function GaugeArc() {
    return (
        <>
            {SEGMENTS.map(segment => (
                <path
                    key={segment.from}
                    d={segmentArcPath(segment)}
                    strokeWidth={GAUGE_STROKE_WIDTH}
                    fill="none"
                    stroke="currentColor"
                    className={segment.strokeClass}
                />
            ))}
        </>
    );
}
