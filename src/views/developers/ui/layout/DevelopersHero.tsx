import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { ACCOUNT_PATH } from '../../lib/developersContent';
import type { DevelopersTranslator } from '../../types';

interface Props {
    readonly t: DevelopersTranslator;
}

/**
 * 페이지 머리: 유일한 `h1`, 무엇을 가져갈 수 있는지와 BYOK 약속, 키 만들기·빠른 시작으로 가는 두 버튼.
 */
export function DevelopersHero({ t }: Props) {
    return (
        <header className="max-w-3xl pb-8">
            <p className="text-sm font-medium text-secondary-400">
                {t('hero.eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-secondary-50 sm:text-[42px] sm:leading-tight">
                {t('hero.title')}
            </h1>
            <p className="mt-4 text-base leading-7 text-pretty text-secondary-300">
                {t('hero.lede')}
            </p>
            <p className="mt-3 text-base leading-7 text-pretty text-secondary-300">
                {t('hero.byok')}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
                <LocaleLink
                    href={ACCOUNT_PATH}
                    prefetch={false}
                    className={cn(BUTTON_PRIMARY, 'h-11 px-5 text-sm')}
                >
                    {t('hero.createKey')}
                </LocaleLink>
                <a
                    href="#quickstart"
                    className={cn(BUTTON_OUTLINE, 'h-11 px-5 text-sm')}
                >
                    {t('hero.quickstart')}
                </a>
            </div>
        </header>
    );
}
