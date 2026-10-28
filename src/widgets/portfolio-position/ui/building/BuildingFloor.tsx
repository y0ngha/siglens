'use client';

/**
 * 빌딩의 층 하나 — 좌/우 벽면, 창문 장식, 층 경계선, 그리고 활성(hover/고정) 하이라이트.
 */
import {
    CENTER_X,
    ISO_DX,
    computeFloorFaces,
    FLOOR_H,
    floorShading,
    pointsAttr,
    ROOF_EAVE_Y,
    ROOF_FRONT_Y,
} from '../../utils/buildingGeometry';
import type { FloorHandlers } from '../../hooks/useFloorTooltip';

interface BuildingFloorProps {
    /** 저점 기준 층 번호 — 0 = 1층(최저가 구간). */
    readonly index: number;
    readonly isActive: boolean;
    /** 있으면 층이 hover/탭에 반응한다(거래량 분포가 있을 때만). */
    readonly handlers: FloorHandlers | null;
}

/**
 * 의도적으로 role/tabIndex/키보드 핸들러가 없다. 이 `<g>`는 부모 `<svg role="img">`의 자손이라
 * 보조 기술은 서브트리를 통째로 평탄화한다 — role="button"을 줘도 읽히지 않고 보이지 않는 포커스만
 * 생겨 키보드 사용자가 갇힌다. 층 툴팁("거주율 N%")은 마우스/터치 사용자용 보강이고, 핵심 정보는
 * svg의 aria-label(`buildAriaLabel`)에 이미 다 있다.
 */
export function BuildingFloor({
    index,
    isActive,
    handlers,
}: BuildingFloorProps) {
    const faces = computeFloorFaces(index);
    const { fromTop, lit, shadow } = floorShading(index);
    const edgeY = ROOF_EAVE_Y + fromTop * FLOOR_H;
    const frontEdgeY = ROOF_FRONT_Y + fromTop * FLOOR_H;
    return (
        <g
            data-testid="building-floor"
            className={
                handlers ? 'cursor-pointer touch-manipulation' : undefined
            }
            {...handlers}
        >
            <polygon
                points={faces.left}
                fill="currentColor"
                className={shadow}
            />
            <polygon points={faces.right} fill="currentColor" className={lit} />
            {faces.windowsLeft.map((w, wi) => (
                <polygon
                    key={`wl-${wi}`}
                    points={pointsAttr(w)}
                    fill="currentColor"
                    className="text-secondary-950/40"
                    aria-hidden="true"
                />
            ))}
            {faces.windowsRight.map((w, wi) => (
                <polygon
                    key={`wr-${wi}`}
                    points={pointsAttr(w)}
                    fill="currentColor"
                    className="text-secondary-300/50"
                    aria-hidden="true"
                />
            ))}
            {/* 층 경계선(정면 모서리) */}
            <line
                x1={CENTER_X - ISO_DX}
                y1={edgeY}
                x2={CENTER_X}
                y2={frontEdgeY}
                stroke="currentColor"
                strokeWidth={0.75}
                className="text-secondary-950/40"
            />
            <line
                x1={CENTER_X}
                y1={frontEdgeY}
                x2={CENTER_X + ISO_DX}
                y2={edgeY}
                stroke="currentColor"
                strokeWidth={0.75}
                className="text-secondary-950/40"
            />
            {/* 활성 하이라이트 — 면 색은 그대로 두고 얇은 테두리만 덧그린다(시각 전용). */}
            {isActive && (
                <>
                    <polygon
                        points={faces.left}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        className="pointer-events-none text-primary-400"
                        aria-hidden="true"
                    />
                    <polygon
                        points={faces.right}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        className="pointer-events-none text-primary-400"
                        aria-hidden="true"
                    />
                </>
            )}
        </g>
    );
}
