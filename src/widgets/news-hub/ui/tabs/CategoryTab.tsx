/**
 * @file 카테고리 탭 줄의 탭 하나(현재 카테고리는 텍스트, 나머지는 링크).
 */
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { cn } from '@/shared/lib/cn';
import type { CategoryTabItem } from '../../utils/categoryTabs';

const TAB_BASE_CLASS =
    'focus-visible:ring-primary-500 flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';
const TAB_ACTIVE_CLASS = 'border-primary-500 text-secondary-100 font-medium';
const TAB_IDLE_CLASS = 'text-secondary-400 hover:text-secondary-100';

interface CategoryTabProps {
    readonly tab: CategoryTabItem;
    /** 번역된 탭 라벨. */
    readonly label: string;
}

/**
 * 현재 카테고리는 링크가 아니라 `<span aria-current="page">`다. 자기 자신을 가리키는
 * 링크는 눌러도 아무 일이 없는 앵커이고 내부 링크 그래프에 자기 참조를 넣는다 —
 * 같은 화면의 `shared/ui/RegionTabs`도 같은 형태를 쓴다.
 */
export function CategoryTab({ tab, label }: CategoryTabProps) {
    const className = cn(
        TAB_BASE_CLASS,
        tab.active ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS
    );

    if (tab.active) {
        return (
            <span aria-current="page" className={className}>
                {label}
            </span>
        );
    }

    return (
        <Link
            href={tab.href}
            // 같은 지역 탭이 한 화면에 모두 보여 마운트 즉시 전부 prefetch된다. `_rsc`
            // 키가 진입 경로마다 달라 캐시가 재사용되지 않으므로 클릭 시점으로 미룬다.
            prefetch={false}
            className={className}
        >
            {label}
        </Link>
    );
}
