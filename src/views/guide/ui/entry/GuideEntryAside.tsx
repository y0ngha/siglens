/** 항목 페이지 오른쪽 열(넓은 화면 전용) — 본문 차례와 분류 목록으로 돌아가는 링크. */
import type { GuideCategory } from '@/entities/guide/types';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import type { TocItem } from '@/shared/lib/legal-toc';
import { LocaleLink } from '@/shared/ui/LocaleLink';

interface GuideEntryAsideProps {
    /** 본문 h2 목록(`extractToc`). 비어 있으면 차례를 그리지 않는다. */
    readonly toc: readonly TocItem[];
    readonly tocLabel: string;
    readonly category: GuideCategory;
    /** "{분류} 목록으로" — 분류 이름이 이미 들어간 문구. */
    readonly backLabel: string;
}

/** `lg` 미만에서는 숨는다 — 좁은 화면은 본문만 읽는다. 차례는 본문을 따라 붙어 있다(`sticky`). */
export function GuideEntryAside({
    toc,
    tocLabel,
    category,
    backLabel,
}: GuideEntryAsideProps) {
    return (
        <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
                {toc.length > 0 ? (
                    <nav aria-label={tocLabel}>
                        <p className="text-sm font-semibold text-secondary-200">
                            {tocLabel}
                        </p>
                        <ol className="mt-3 space-y-1 border-l border-secondary-700">
                            {toc.map(item => (
                                <li key={item.id}>
                                    <a
                                        href={`#${item.id}`}
                                        className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-secondary-400 transition-colors hover:border-primary-400 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                ) : null}
                <LocaleLink
                    href={guideCategoryPath(category)}
                    prefetch={false}
                    className="block rounded-sm text-sm text-secondary-400 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none"
                >
                    {backLabel}
                </LocaleLink>
            </div>
        </aside>
    );
}
