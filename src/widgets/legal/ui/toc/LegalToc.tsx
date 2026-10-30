import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type { TocItem } from '@/shared/lib/legal-toc';

interface LegalTocProps {
    /** 본문 h2에서 뽑은 항목. `id`는 본문 제목의 slug와 같다. */
    readonly items: readonly TocItem[];
    /**
     * 항목 라벨의 언어(BCP-47). 라벨은 본문 제목이라 번역이 없어 다른 언어 원문을
     * 낼 때는 페이지 언어와 다르다.
     */
    readonly lang: string;
    /** 바로 위에 안내 상자가 없을 때만 위 여백을 준다(안내 상자가 `my-8`을 가진다). */
    readonly withTopMargin: boolean;
}

/** 약관 본문 목차. 항목은 본문 제목 앵커(`#id`)로 이동한다. */
export function LegalToc({ items, lang, withTopMargin }: LegalTocProps) {
    const t = useTranslations('widgets.legal');
    const title = t('LegalPageShell.7474d0');
    return (
        <nav
            aria-label={title}
            className={cn(SURFACE_CARD, 'mb-8 p-5', withTopMargin && 'mt-8')}
        >
            <p className="mb-3 text-xs font-semibold text-secondary-400">
                {title}
            </p>
            <ol lang={lang} className="space-y-2 text-sm">
                {items.map(item => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            className="text-secondary-300 transition-colors hover:text-primary-400"
                        >
                            {item.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
