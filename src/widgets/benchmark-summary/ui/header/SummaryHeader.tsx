/** 요약 섹션의 제목과 읽는 법 한 줄. */
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface Props {
    /** 섹션의 `aria-labelledby`가 가리키는 제목 id. */
    readonly headingId: string;
    readonly title: string;
    readonly sub: string;
    /** 제목·설명을 가운데 정렬한다. */
    readonly centered: boolean;
}

/** 섹션 제목(h2)과 설명 문단. */
export function SummaryHeader({ headingId, title, sub, centered }: Props) {
    return (
        <>
            <h2
                id={headingId}
                className={cn(
                    HEADING_SECTION,
                    'text-2xl sm:text-[28px]',
                    centered && 'text-center'
                )}
            >
                {title}
            </h2>
            <p
                className={cn(
                    'mt-2 max-w-2xl text-[15px] leading-6 text-secondary-400',
                    centered && 'mx-auto text-center'
                )}
            >
                {sub}
            </p>
        </>
    );
}
