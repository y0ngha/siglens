import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { SymbolDirectorySection } from '@/shared/lib/symbolDirectory';

interface SymbolDirectoryListProps {
    readonly sections: readonly SymbolDirectorySection[];
    /** 섹션 `labelKey`를 현재 로케일 라벨로 바꾼다 — 서버 번역자를 감싼 함수. */
    readonly labelOf: (key: SymbolDirectorySection['labelKey']) => string;
}

/**
 * `/symbols`의 자산군별 링크 목록. 각 링크는 크롤러가 내부 링크로 발견하도록 `<a>`로 남긴다.
 */
export function SymbolDirectoryList({
    sections,
    labelOf,
}: SymbolDirectoryListProps) {
    return (
        <>
            {sections.map(section => (
                <section key={section.id} className="space-y-3">
                    <h2
                        id={`symbols-${section.id}`}
                        className="text-lg font-semibold text-secondary-100"
                    >
                        {labelOf(section.labelKey)}
                        <span className="ml-2 text-sm font-normal text-secondary-500">
                            {section.items.length}
                        </span>
                    </h2>
                    <ul
                        aria-labelledby={`symbols-${section.id}`}
                        className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
                    >
                        {section.items.map(item => (
                            <li key={item.symbol} className="min-w-0">
                                <Link
                                    href={`/${item.symbol}`}
                                    // 400여 개 링크에 prefetch가 붙으면 진입만으로
                                    // 수백 개 `_rsc` 요청이 나간다.
                                    prefetch={false}
                                    // 모바일은 두 칸이라 `삼성바이오로직스 (207940.KS)`가
                                    // 말줄임으로 잘리면 어느 종목인지 알 수 없다 — 줄바꿈하고
                                    // (한글은 어절 단위 `break-keep`, 긴 티커는 `wrap-break-word`),
                                    // 칸이 넓은 `sm` 이상에서만 한 줄 말줄임을 쓴다.
                                    className="block rounded text-sm wrap-break-word break-keep text-secondary-300 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:truncate"
                                >
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </>
    );
}
