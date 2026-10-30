/**
 * `/methodology` 상단 목차.
 */
import {
    METHODOLOGY_SECTION_IDS,
    type MethodologySectionId,
} from '../../lib/methodologySections';

/** 목차 링크. 밑줄 없이 한 줄에 흐르고, 터치 영역은 44px이다. */
const TOC_LINK =
    'inline-flex min-h-11 items-center rounded px-2 text-sm text-secondary-300 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface Props {
    /** 목차 내비게이션의 접근 가능한 이름. */
    readonly label: string;
    readonly titles: Readonly<Record<MethodologySectionId, string>>;
}

/** 섹션 순서대로 각 `<h2>` 앵커로 가는 같은 페이지 링크 목록. */
export function MethodologyToc({ label, titles }: Props) {
    return (
        <nav
            aria-label={label}
            className="mb-14 border-y border-secondary-700 py-2"
        >
            <ul className="flex flex-wrap gap-x-1 gap-y-0">
                {METHODOLOGY_SECTION_IDS.map(id => (
                    <li key={id}>
                        <a href={`#${id}`} className={TOC_LINK}>
                            {titles[id]}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
