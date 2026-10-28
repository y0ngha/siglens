/**
 * 빌딩의 고정 뼈대 — 지붕, 정면 모서리·좌우 외곽선, 지면 타원. 데이터와 무관하게 늘 같다.
 */
import {
    CENTER_X,
    ISO_DX,
    GROUND_EAVE_Y,
    GROUND_ELLIPSE_CY_OFFSET,
    GROUND_ELLIPSE_RX_OFFSET,
    GROUND_FRONT_Y,
    ISO_DY,
    ROOF_EAVE_Y,
    ROOF_FRONT_Y,
    ROOF_POLYGON,
} from '../../utils/buildingGeometry';

/** 층 위에 그린다 — 지붕이 최상층 벽면 윗변을 덮고, 정면 모서리 선이 마커의 기준선이 된다. */
export function BuildingFrame() {
    return (
        <>
            <polygon
                points={ROOF_POLYGON}
                fill="currentColor"
                className="text-secondary-400/45"
                stroke="currentColor"
                strokeWidth={1}
                data-testid="building-roof"
            />
            {/* 건물 정면 모서리 세로선 — 마커가 이 선을 기준으로 위치한다 */}
            <line
                x1={CENTER_X}
                y1={ROOF_FRONT_Y}
                x2={CENTER_X}
                y2={GROUND_FRONT_Y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-secondary-500"
            />
            {([-1, 1] as const).map(side => (
                <line
                    key={side}
                    x1={CENTER_X + side * ISO_DX}
                    y1={ROOF_EAVE_Y}
                    x2={CENTER_X + side * ISO_DX}
                    y2={GROUND_EAVE_Y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-secondary-500"
                />
            ))}
            <ellipse
                cx={CENTER_X}
                cy={GROUND_FRONT_Y + GROUND_ELLIPSE_CY_OFFSET}
                rx={ISO_DX + GROUND_ELLIPSE_RX_OFFSET}
                ry={ISO_DY / 2}
                fill="currentColor"
                className="text-secondary-950/40"
                aria-hidden="true"
            />
        </>
    );
}
