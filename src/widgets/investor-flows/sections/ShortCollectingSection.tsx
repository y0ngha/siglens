import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { CollectingNotice } from './CollectingNotice';

const HEADING_ID = 'flows-short-heading';

/**
 * 공매도 구간의 "수집 중" 자리 — FINRA가 켜져 있는데 첫 수집이 아직 안 끝났을 때, 섹션을 통째로 숨기는 대신(숨기면
 * 이 종목에 공매도 데이터가 없는 것처럼 보인다) 같은 제목 아래에 안내를 낸다. `ShortSection`과 같은 헤딩 id를 쓴다 —
 * 둘이 한 화면에 같이 나오지 않는다.
 */
export function ShortCollectingSection() {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-6 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('short.title')}
                    <FlowTooltip term="shortInterest" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('short.subtitle')}
                </p>
            </div>
            <CollectingNotice variant="short" />
        </section>
    );
}
