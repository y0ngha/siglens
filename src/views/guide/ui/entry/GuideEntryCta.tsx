/** 항목 페이지 끝의 종목 검색 안내 카드. */
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';

const CTA_HEADING_ID = 'guide-cta-heading';

interface GuideEntryCtaProps {
    readonly heading: string;
    readonly body: string;
    readonly buttonLabel: string;
}

/** 제목(h2)·한 줄 설명·홈(종목 검색)으로 가는 버튼. */
export function GuideEntryCta({
    heading,
    body,
    buttonLabel,
}: GuideEntryCtaProps) {
    return (
        <section
            aria-labelledby={CTA_HEADING_ID}
            className={cn(
                SURFACE_CARD,
                'mt-14 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between'
            )}
        >
            <div className="max-w-md">
                <h2 id={CTA_HEADING_ID} className={HEADING_SECTION}>
                    {heading}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-secondary-400">
                    {body}
                </p>
            </div>
            <LocaleLink
                href="/"
                prefetch={false}
                className={cn(BUTTON_OUTLINE, 'min-h-11 shrink-0 px-5 text-sm')}
            >
                {buttonLabel}
            </LocaleLink>
        </section>
    );
}
