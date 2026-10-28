'use client';

/**
 * 포지션 빌딩 — 회원 평단·현재가를 최근 고/저 범위 안에서 보여 주는 아이소메트릭 건물. 좌표는
 * `utils/buildingGeometry`, 문구는 `utils/positionBuildingNotes`, 층 툴팁 상태는
 * `useFloorTooltip`, 그림 조각은 `ui/building/*`가 맡고 이 파일은 그것들을 조합한다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import type { PositionModel } from '../utils/positionGeometry';
import {
    AVG_LABEL_PREFIX_KEY,
    avgFloorVisualNote,
    buildAriaLabel,
    buildAriaLabelCurrentOnly,
    buildFloorTooltips,
    computeActiveFloorTooltipContent,
    CURRENT_LABEL_PREFIX_KEY,
    describeFloor,
    formatFloorTooltipText,
    outOfRangeGlyph,
    outOfRangeNote,
} from '../utils/positionBuildingNotes';
import {
    formatAmount,
    formatCompactForSvgLabel,
} from '../utils/buildingPriceFormat';
import {
    CENTER_X,
    computeMarkerLayout,
    HIGH_LABEL_Y,
    LOW_LABEL_Y,
    VIEWBOX_H,
    VIEWBOX_W,
} from '../utils/buildingGeometry';
import { currentMarkerClass, returnTextClass } from '../utils/returnTone';
import { useFloorTooltip } from '../hooks/useFloorTooltip';
import { BuildingFloor } from './building/BuildingFloor';
import { BuildingFrame } from './building/BuildingFrame';
import { AvgMarker, CurrentMarker } from './building/PriceMarkers';
import { FloorTooltip } from './building/FloorTooltip';

interface PositionBuildingProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    /**
     * 회원 평단. `null`이면 **현재가만** 그린다 — ★평단 마커·라벨·층 안내와
     * 수익률 리드아웃, 그리고 두 마커를 벌려 놓는 dodge가 전부 빠지고 현재가
     * 마커는 수익/손실 색 대신 중립색을 쓴다. 비회원·미보유 회원에게 건물을
     * 먼저 보여주는 CTA(`PositionCta`)가 이 모드를 쓴다. 호출부는 그때
     * `computePosition({ ...range, current, avg: current })`로 model을 만든다
     * (`avg`는 양수 가드에만 쓰이고 currentPos/currentClamped에는 영향이 없다 —
     * `[symbol]/position/page.tsx`의 `resolveCurrentPricePosition`과 같은 근거).
     */
    avg: number | null;
    className?: string;
    /**
     * 5개 가격대(밴드)별 최근(52주/252봉) 거래량 비중(%), index 0=최저가
     * 밴드(positionGeometry의 BANDS/이 컴포넌트의 층 순서와 동일). optional —
     * null/undefined면 층 hover가 완전히 비활성화되고 건물은 이 prop이
     * 추가되기 전과 동일하게 렌더된다(`/portfolio` 압축 카드는 이 prop을
     * 전달하지 않아 항상 이 상태다). 순수 raw 히스토그램 — 시그널/해석 없음
     * (scope fence, volumeByBand.ts와 동일 원칙).
     */
    volumeByBand?: readonly number[] | null;
}

const RANGE_LABEL_CLASS =
    'fill-current text-[10px] font-medium text-secondary-400 tabular-nums';

/**
 * PositionGauge의 idiom(viewBox + currentColor + role="img" + dodge + compact 라벨)을 잇는 순수
 * 프레젠테이션이다 — 층·마커 위치는 전달받은 `PositionModel`에서만 파생한다. 건물 면만 스큐
 * 폴리곤이고 라벨·마커 텍스트는 항상 upright(가독성)다.
 */
export function PositionBuilding({
    symbol,
    model,
    low52w,
    high52w,
    current,
    avg,
    className,
    volumeByBand,
}: PositionBuildingProps) {
    const t = useTranslations('widgets.portfolio-position');
    const tPos = useTranslations('widgets.portfolio-position.positionNote');
    // 층 hover/탭 — 거래량 분포가 없으면 핸들러를 붙이지 않아 상태가 늘 비어 있다.
    const { containerRef, activeFloor, handlersFor } = useFloorTooltip();

    const bandCount = model.bands.length;
    // 층별 툴팁 콘텐츠를 한 번에 만든다 — 활성 층 조회와 층별 반응 여부가 같은 배열을 본다.
    const floorTooltips = buildFloorTooltips(
        model,
        volumeByBand,
        low52w,
        high52w,
        bandCount,
        symbol,
        tPos
    );
    const activeTooltip = computeActiveFloorTooltipContent(
        activeFloor,
        floorTooltips
    );

    const hasAvg = avg !== null;
    const currentDisplay = formatAmount(current, symbol);
    // 평단 없는 모드에선 model.avgPos가 currentPos의 복제일 뿐이라 평단 문구를 만들지 않는다.
    const avgFloorNote = hasAvg
        ? describeFloor(model.avgPos, model.avgClamped, bandCount, tPos)
        : '';
    const ariaLabel = hasAvg
        ? buildAriaLabel(
              symbol,
              model,
              formatAmount(avg, symbol),
              currentDisplay,
              avgFloorNote,
              tPos
          )
        : buildAriaLabelCurrentOnly(
              symbol,
              model,
              currentDisplay,
              describeFloor(
                  model.currentPos,
                  model.currentClamped,
                  bandCount,
                  tPos
              ),
              tPos
          );
    const currentNote = outOfRangeNote(model.currentClamped, tPos);
    const layout = computeMarkerLayout(model, hasAvg);

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex min-h-[280px] flex-col items-center gap-2',
                className
            )}
            data-testid="position-building"
        >
            <svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                // 모바일 280px 상한, sm/lg는 PositionTabMemberContent의 래퍼 폭(340/440px)에 맞춘다 —
                // svg 자체 상한이 병목이 되지 않게. `/portfolio` 압축 카드는 바깥 div에 더 작은
                // `max-w-[200px]`를 넘겨 이 상한들의 영향을 받지 않는다.
                className="h-full w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[440px]"
                role="img"
                aria-label={ariaLabel}
            >
                <text
                    x={CENTER_X}
                    y={HIGH_LABEL_Y}
                    textAnchor="middle"
                    className={RANGE_LABEL_CLASS}
                >
                    {formatCompactForSvgLabel(high52w, symbol)}
                </text>
                <text
                    x={CENTER_X}
                    y={LOW_LABEL_Y}
                    textAnchor="middle"
                    className={RANGE_LABEL_CLASS}
                >
                    {formatCompactForSvgLabel(low52w, symbol)}
                </text>

                {/* bands[0]=저점 인접(1층) ... bands[4]=고점 인접(최상층) */}
                {model.bands.map((band, i) => {
                    const isInteractive = floorTooltips[i] !== null;
                    return (
                        <BuildingFloor
                            key={`${band.fromPct}-${band.toPct}`}
                            index={i}
                            isActive={isInteractive && activeFloor?.index === i}
                            handlers={isInteractive ? handlersFor(i) : null}
                        />
                    );
                })}
                <BuildingFrame />

                {hasAvg && (
                    <AvgMarker
                        x={layout.avgX}
                        y={layout.avgY}
                        prefix={tPos(AVG_LABEL_PREFIX_KEY)}
                        price={formatCompactForSvgLabel(avg, symbol)}
                        // 시각 노트는 폭 제약 때문에 범위 밖이면 메타포만, 전체 문구는 aria-label이 담는다.
                        floorNote={
                            outOfRangeGlyph(model.avgClamped) +
                            avgFloorVisualNote(
                                model.avgClamped,
                                avgFloorNote,
                                tPos
                            )
                        }
                    />
                )}
                <CurrentMarker
                    x={layout.currentX}
                    y={layout.currentY}
                    prefix={tPos(CURRENT_LABEL_PREFIX_KEY)}
                    price={formatCompactForSvgLabel(current, symbol)}
                    toneClass={currentMarkerClass(model.returnPct, hasAvg)}
                    outOfRangeNote={
                        currentNote === null
                            ? null
                            : outOfRangeGlyph(model.currentClamped) +
                              currentNote
                    }
                />
            </svg>

            {/* 수익/손실 리드아웃 — 위치 서술만(범위 내 어디), good/bad entry 판단 금지 */}
            {hasAvg && (
                <p
                    data-testid="return-readout"
                    className={cn(
                        'text-center text-xs tabular-nums',
                        returnTextClass(model.returnPct)
                    )}
                >
                    {t('PositionBuilding.305967', {
                        v0: formatSignedPercent(model.returnPct),
                        v1: model.rangePositionPct.toFixed(0),
                    })}
                </p>
            )}

            {/* 층 리드아웃 — 마우스/터치 사용자용 시각 보강이라 aria-hidden(svg aria-label이 핵심 정보를
                이미 전한다). 거래량 분포가 없으면 아예 그리지 않는다. */}
            {volumeByBand && (
                <p
                    data-testid="floor-volume-readout"
                    aria-hidden="true"
                    className="min-h-[1rem] text-center text-xs text-secondary-300 tabular-nums"
                >
                    {activeTooltip
                        ? formatFloorTooltipText(activeTooltip)
                        : ' '}
                </p>
            )}

            {activeFloor !== null && activeTooltip !== null && (
                <FloorTooltip
                    key={activeFloor.index}
                    anchorRect={activeFloor.rect}
                    content={activeTooltip}
                />
            )}
        </div>
    );
}
