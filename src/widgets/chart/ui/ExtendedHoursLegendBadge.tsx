'use client';

/**
 * 프리·애프터마켓 음영 범례 칩 — 시간외 봉이 그려질 때 차트 오른쪽 위에 띄운다.
 */
import { useTranslations } from 'next-intl';

/** 시간외 음영 색 점과 "시간외" 라벨을 그린다(장식 점은 스크린리더에서 숨긴다). */
export function ExtendedHoursLegendBadge() {
    const t = useTranslations('widgets.chart');
    return (
        <div className="pointer-events-none absolute top-1 right-16 z-10 flex items-center gap-1 rounded bg-secondary-900/80 px-1.5 py-0.5 text-[10px] text-secondary-300">
            <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-sm border border-secondary-500/70 bg-secondary-500/30"
            />
            <span>{t('StockChart.extendedHoursLegend')}</span>
        </div>
    );
}
