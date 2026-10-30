/**
 * `/methodology` "변경 이력" — 방법·정책이 바뀐 날과 내용.
 */
import type { Locale } from '@/shared/i18n/locales';
import type { MethodologySectionProps } from '../../types';
import { methodologyChangelogItems } from '../../lib/methodologyChangelog';
import { MethodologySection } from '../layout/MethodologySection';

interface Props extends MethodologySectionProps {
    /** 날짜 표기의 로케일. */
    readonly locale: Locale;
}

/** 최신순 이력. 각 날짜는 기계가 읽는 `<time dateTime>`을 함께 단다. */
export function ChangelogSection({ t, title, locale }: Props) {
    const items = methodologyChangelogItems(t, locale);
    return (
        <MethodologySection
            id="changelog"
            title={title}
            sub={t('changelog.sub')}
        >
            <ol className="mt-6 flex max-w-2xl flex-col divide-y divide-secondary-700 border-y border-secondary-700">
                {items.map(item => (
                    <li
                        key={item.key}
                        className="grid gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
                    >
                        <time
                            dateTime={item.date}
                            className="text-sm text-secondary-400 tabular-nums"
                        >
                            {item.label}
                        </time>
                        <p className="text-sm leading-6 text-secondary-300">
                            {item.text}
                        </p>
                    </li>
                ))}
            </ol>
        </MethodologySection>
    );
}
