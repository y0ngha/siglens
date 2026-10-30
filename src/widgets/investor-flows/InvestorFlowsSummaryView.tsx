/**
 * 수급 AI 해석 결과 화면 — 한 줄 요약·축별 해석·핵심 신호·위험.
 */
import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsAnalysisResponse,
    InvestorFlowsMarket,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { axisTitleKey } from './utils/axisKeys';

interface BulletBlockProps {
    readonly title: string;
    readonly items: readonly string[];
}

function BulletBlock({ title, items }: BulletBlockProps) {
    if (items.length === 0) return null;
    return (
        <div className="mb-5 last:mb-0">
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>{title}</h3>
            <ul aria-label={title} className="space-y-1.5">
                {items.map((item, i) => (
                    <li
                        key={`${i}-${item}`}
                        className="flex gap-2 text-sm text-secondary-400"
                    >
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            •
                        </span>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface InvestorFlowsSummaryViewProps {
    readonly result: InvestorFlowsAnalysisResponse;
    /** 축 제목을 시장에 맞춘다(한국 내부자 슬롯은 "임원·주요주주"). 기본 `us`. */
    readonly market?: InvestorFlowsMarket;
}

/**
 * AI 수급 해석 카드. 점수·라벨은 위 점수 카드가 코드로 계산한 값이고, 여기는 그 해석(요약·축별 해석·핵심 신호·
 * 위험·데이터 참고)이다. 필드가 비어 있으면 그 블록을 통째로 뺀다(깨진 LLM 응답은 core가 정규화한다).
 */
export function InvestorFlowsSummaryView({
    result,
    market = 'us',
}: InvestorFlowsSummaryViewProps) {
    const t = useTranslations('widgets.investor-flows');
    const tAxis = useTranslations('widgets.investor-flows.axis');
    return (
        <section
            aria-labelledby="investor-flows-summary-heading"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2
                id="investor-flows-summary-heading"
                className={cn('mb-4', HEADING_SECTION)}
            >
                {t('ai.title')}
            </h2>
            {result.summaryKo.length > 0 && (
                <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                    {result.summaryKo}
                </p>
            )}
            {result.axisInterpretations.length > 0 && (
                <div className="mb-5">
                    <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                        {t('ai.axes')}
                    </h3>
                    <ul aria-label={t('ai.axes')} className="space-y-3">
                        {result.axisInterpretations.map(item => (
                            <li
                                key={item.axis}
                                className="rounded-lg bg-secondary-800/40 p-3"
                            >
                                <p className="mb-1 text-sm font-medium text-secondary-200">
                                    {tAxis(axisTitleKey(item.axis, market))}
                                </p>
                                <p className="text-sm leading-relaxed text-secondary-400">
                                    {item.interpretationKo}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <BulletBlock
                title={t('ai.keySignals')}
                items={result.keySignalsKo}
            />
            <BulletBlock title={t('ai.risks')} items={result.risksKo} />
            <BulletBlock title={t('ai.dataNotes')} items={result.dataNotesKo} />
        </section>
    );
}
