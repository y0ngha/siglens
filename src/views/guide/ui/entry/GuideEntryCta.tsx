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
 * 검색 패널을 이 자리에 둔다 — 독자가 다른 페이지를 거치지 않고 읽은 개념을 바로 관심 종목에서
 * 확인하게 하려는 것이다. 패널은 홈 히어로와 같은 것이라 모바일은 전체화면 검색 오버레이를 열고
 * (`SearchOverlayProvider`는 모든 `[locale]` 라우트를 감싸는 `SiteChrome`에 있다), 데스크톱은
 * 자리에서 자동완성한다. 제목 id가 고정이라 한 페이지에 한 번만 둔다.
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
