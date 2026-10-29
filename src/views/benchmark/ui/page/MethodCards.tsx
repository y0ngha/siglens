/**
 * 방법론 요약 카드 격자(h3 + 문단).
 */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

/** 카드 한 장. 문단은 번역된 문장이다. */
export interface MethodCard {
    readonly key: string;
    readonly title: string;
    readonly paragraphs: readonly string[];
    /** 넓은 화면에서 두 칸을 차지한다. */
    readonly wide?: boolean;
}

interface Props {
    readonly cards: readonly MethodCard[];
}

/** 카드 순서대로 그린다. 넓은 화면에서는 두 칸 격자다. */
export function MethodCards({ cards }: Props) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            {cards.map(card => (
                <div
                    key={card.key}
                    className={cn(
                        SURFACE_CARD,
                        'p-4 sm:p-5',
                        card.wide && 'md:col-span-2'
                    )}
                >
                    <h3 className={HEADING_SUBSECTION}>{card.title}</h3>
                    {card.paragraphs.map(paragraph => (
                        <p
                            key={paragraph}
                            className="mt-2 text-sm leading-6 text-secondary-300"
                        >
                            {paragraph}
                        </p>
                    ))}
                </div>
            ))}
        </div>
    );
}
