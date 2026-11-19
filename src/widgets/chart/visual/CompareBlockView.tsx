'use client';

import { useTranslations } from 'next-intl';
import type { ChatCompareBlock } from '@/entities/chat-conversation/types';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { CompareLineChart } from './CompareLineChart';
import { signedPercent } from './format';
import { VisualBlockFrame, type VisualTable } from './VisualBlockFrame';

const isoDate = (seconds: number): string =>
    new Date(seconds * 1000).toISOString().slice(0, 10);

/** 종목 비교 블록 — 선 차트와 표(종목별 시작·종료일·수익률), 요약 aria. */
export function CompareBlockView({
    block,
}: {
    readonly block: ChatCompareBlock;
}) {
    const t = useTranslations('widgets.chart');
    // 차트 색은 생성 시점 값이라 테마가 바뀌면 다시 만든다(`chartThemeRemountGuard`).
    const themeVersion = useThemeVersion();
    // 키는 리터럴 호출로 둔다 — 조립한 키 문자열은 추출기가 못 봐 카탈로그에서 지워진다(`I18N.md#I18-10`).
    const periodLabels = {
        '1M': t('ChatVisual.period1M'),
        '3M': t('ChatVisual.period3M'),
        '6M': t('ChatVisual.period6M'),
        '1Y': t('ChatVisual.period1Y'),
    };
    const period = periodLabels[block.period];
    const lastOf = (points: readonly [number, number][]): number =>
        points.at(-1)?.[1] ?? 0;
    const table: VisualTable = {
        head: [
            t('ChatVisual.colSymbol'),
            t('ChatVisual.colFrom'),
            t('ChatVisual.colTo'),
            t('ChatVisual.colChange'),
        ],
        rows: block.series.map(s => [
            s.symbol,
            isoDate(s.points[0]?.[0] ?? 0),
            isoDate(s.points.at(-1)?.[0] ?? 0),
            signedPercent(lastOf(s.points)),
        ]),
    };
    return (
        <VisualBlockFrame
            title={t('ChatVisual.compareTitle', { period })}
            ariaLabel={t('ChatVisual.compareAria', {
                symbols: block.series.map(s => s.symbol).join(', '),
                period,
                changes: block.series
                    .map(s => `${s.symbol} ${signedPercent(lastOf(s.points))}`)
                    .join(', '),
            })}
            tableLabel={t('ChatVisual.dataTable')}
            table={table}
            asOfText={t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) })}
        >
            <CompareLineChart key={themeVersion} block={block} />
        </VisualBlockFrame>
    );
}
