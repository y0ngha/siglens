import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

const CTA_HEADING_ID = 'guide-cta-heading';

interface GuideEntryCtaProps {
    readonly heading: string;
    readonly body: string;
}

/**
 * 항목을 다 읽은 독자를 실제 종목 차트로 보내는 출구(`GuideEntryPage` 끝).
 *
 * 홈으로 보내는 링크 대신 검색 패널을 이 자리에 둔다. 가이드는 검색 유입이 가장 많은 진입
 * 페이지인데 종목으로 가려면 홈을 한 번 거쳐야 했고, 그 한 번의 이동에서 독자가 빠져나갔다.
 * 패널은 홈 히어로와 같은 것이라 모바일은 전체화면 검색 오버레이를 열고, 데스크톱은 자리에서
 * 자동완성한다. 제목 id가 고정이라 한 페이지에 한 번만 둔다.
 */
export function GuideEntryCta({ heading, body }: GuideEntryCtaProps) {
    return (
        <section
            aria-labelledby={CTA_HEADING_ID}
            className={cn(SURFACE_CARD, 'mt-14 p-6')}
        >
            <h2 id={CTA_HEADING_ID} className={HEADING_SECTION}>
                {heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                {body}
            </p>
            <SymbolSearchPanel className="mt-5" />
        </section>
    );
}
