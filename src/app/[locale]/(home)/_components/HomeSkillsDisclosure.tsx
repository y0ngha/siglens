import type { HomeSkillItem } from '@/widgets/home/utils/toSkillShowcaseItems';
import { SkillsShowcase } from '@/widgets/home/SkillsShowcase';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { ChevronDownIcon } from '@/shared/ui/StrokeIcons';

interface HomeSkillsDisclosureProps {
    /** 닫힌 상태에서 보이는 한 줄("분석 기법 N개 보기"). 페이지가 번역해 넘긴다. */
    readonly summaryLabel: string;
    readonly skills: HomeSkillItem[];
}

/**
 * 기법 카드 격자(`SkillsShowcase`)를 **닫힌** `<details>`에 담는다. 격자는 홈 길이의 5분의 1이었지만
 * 카드마다 가이드 항목으로 가는 링크라, 가이드가 막 색인되는 동안 홈 → 가이드 내부 링크를 줄이지
 * 않으려고 접기만 한다. 네이티브 `details`라 닫혀 있어도 카드와 링크가 서버 HTML에 그대로 있다
 * (`display:none`이 아니라 브라우저가 접는다). 제거 여부는 배포 후 색인·유입 측정을 보고 다시 정한다.
 */
export function HomeSkillsDisclosure({
    summaryLabel,
    skills,
}: HomeSkillsDisclosureProps) {
    return (
        <details className="group">
            <summary
                className={cn(
                    SURFACE_CARD,
                    'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-medium text-secondary-200 hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden'
                )}
            >
                <span>{summaryLabel}</span>
                <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform group-open:rotate-180"
                />
            </summary>
            <SkillsShowcase skills={skills} />
        </details>
    );
}
