/** 가이드 항목의 설명용 데모 차트(순수 SVG). */
import { useFormatter, useTranslations } from 'next-intl';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { GuideDemo } from '@/views/guide/demos/types';
import {
    DEMO_CHART_FONT,
    DEMO_CHART_MARGIN_BOTTOM,
    DEMO_CHART_MARGIN_TOP,
    DEMO_CHART_WIDTH,
    DEMO_PRICE_HEIGHT,
    demoChartFrame,
    layoutOverlayLabels,
    overlayKey,
} from '@/views/guide/lib/demoChartLayout';
import { DemoCandles } from '@/views/guide/ui/demo-chart/DemoCandles';
import { DemoOverlayShape } from '@/views/guide/ui/demo-chart/DemoOverlayShape';
import { DemoPriceGrid } from '@/views/guide/ui/demo-chart/DemoPriceGrid';
import { DemoTextLabel } from '@/views/guide/ui/demo-chart/DemoTextLabel';
import { GuideDemoPane } from '@/views/guide/ui/GuideDemoPane';

interface GuideDemoChartProps {
    readonly demo: GuideDemo;
    readonly title: string;
    readonly caption: string | null;
}

/**
 * 캡션이 없을 때 SVG 설명(`<desc>`) — 봉 수와 보조 패널 이름. 패널 이름은 로케일의 목록 형식으로 잇는다.
 */
function useFallbackDescription(demo: GuideDemo): string {
    const t = useTranslations('views.guide');
    const format = useFormatter();
    const paneLabels = (demo.panes ?? []).map(pane => pane.label);
    const count = demo.bars.length;
    if (paneLabels.length === 0) return t('demoFallbackDescription', { count });
    return t('demoFallbackDescriptionWithPanes', {
        count,
        panes: format.list(paneLabels, { type: 'conjunction' }),
    });
}

/**
 * 가이드 항목의 설명용 데모 차트. 순수 SVG를 서버에서 그리므로 클라이언트 JS가 없고,
 * 색은 전부 디자인 토큰이라 다크/라이트를 따른다.
 *
 * 그리는 순서: 강조 구간 → 눈금 → (가격 영역 안에서) 오버레이 도형 → 봉 → 표식 → 라벨 → 보조 패널.
 * 표식은 봉 위에 올라와야 가려지지 않는다.
 *
 * 캡션이 있으면 SVG 설명은 보이는 `figcaption`을 가리킨다 — 같은 글을 `<desc>`에 한 번 더 두면
 * 스크린리더가 두 번 읽는다. 캡션이 없을 때만 `<desc>`에 봉 수·패널을 적는다.
 */
export function GuideDemoChart({ demo, title, caption }: GuideDemoChartProps) {
    const uid = useId();
    const descId = `${uid}-desc`;
    const captionId = `${uid}-caption`;
    const clipId = `${uid}-clip`;
    const fallbackDescription = useFallbackDescription(demo);
    const frame = demoChartFrame(demo);
    const { plot, pitch } = frame;
    const overlays = demo.overlays ?? [];
    const labels = layoutOverlayLabels(demo, frame);
    const shapes = (keep: (isMarker: boolean) => boolean) =>
        overlays.map((overlay, index) =>
            keep(overlay.kind === 'marker') ? (
                <DemoOverlayShape
                    key={overlayKey(overlay, index)}
                    bars={demo.bars}
                    frame={frame}
                    overlay={overlay}
                />
            ) : null
        );

    return (
        <figure
            className={cn(
                SURFACE_CARD,
                'mx-auto w-full max-w-xl overflow-hidden'
            )}
        >
            {/*
             * 접근 가능한 이름은 `<title>` 요소가 아니라 `aria-label`로 단다. 본문 SVG의
             * `<title>`도 SEO 검사기는 문서 제목으로 세어
             * "title 태그 2개"로 잡는다 — 스크린리더가 읽는 이름·설명은 그대로다.
             */}
            <svg
                aria-describedby={caption === null ? descId : captionId}
                aria-label={title}
                className="block h-auto w-full"
                role="img"
                viewBox={`0 0 ${DEMO_CHART_WIDTH} ${frame.totalHeight}`}
            >
                {caption === null ? (
                    <desc id={descId}>{fallbackDescription}</desc>
                ) : null}
                <defs>
                    <clipPath id={clipId}>
                        <rect
                            height={DEMO_PRICE_HEIGHT}
                            width={frame.plotWidth}
                            x={plot.left}
                            y={plot.top}
                        />
                    </clipPath>
                </defs>
                {demo.highlight !== undefined && (
                    <rect
                        className="fill-primary-500"
                        fillOpacity={0.09}
                        height={
                            frame.totalHeight -
                            DEMO_CHART_MARGIN_TOP -
                            DEMO_CHART_MARGIN_BOTTOM
                        }
                        width={
                            (demo.highlight.toIndex -
                                demo.highlight.fromIndex +
                                1) *
                            pitch
                        }
                        x={plot.left + demo.highlight.fromIndex * pitch}
                        y={DEMO_CHART_MARGIN_TOP}
                    />
                )}
                <DemoPriceGrid frame={frame} />
                <g clipPath={`url(#${clipId})`}>
                    {shapes(isMarker => !isMarker)}
                    <DemoCandles bars={demo.bars} frame={frame} />
                    {shapes(isMarker => isMarker)}
                </g>
                {labels.map(label => (
                    <DemoTextLabel key={label.key} label={label} />
                ))}
                {demo.panes?.map((pane, index) => (
                    <GuideDemoPane
                        key={pane.label}
                        frame={frame.panes[index]}
                        labelFontSize={DEMO_CHART_FONT}
                        pane={pane}
                    />
                ))}
            </svg>
            {caption !== null && (
                <figcaption
                    id={captionId}
                    className="px-3 pt-1 pb-3 text-sm leading-relaxed text-secondary-300"
                >
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}
