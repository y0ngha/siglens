'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/shared/i18n/locales';
import { ContrastIcon, TranslateIcon } from '@/shared/ui/StrokeIcons';
import { ThemeRadioGroup } from '@/shared/ui/ThemeRadioGroup';
import { useLocaleSwitch } from '../../hooks/useLocaleSwitch';
import { LocaleRadioGroup } from '../locale/LocaleRadioGroup';

const HEADING_CLASS =
    'flex items-center gap-2 px-3 pt-2 pb-1 text-xs font-medium text-secondary-400';

interface PreferencesSectionProps {
    /**
     * 언어를 고른 뒤 부른다. 언어 전환은 라우터 이동이라 호스트 패널을 닫는다. 테마는 그 자리에서
     * 바로 칠해져 결과가 보이므로 패널을 열어 둔다.
     */
    readonly onLocaleSelect?: () => void;
}

/**
 * 언어·테마 설정 묶음. 비회원은 헤더의 文A 버튼 패널(`HeaderPreferencesMenu`), 회원은 아바타
 * 메뉴(`UserMenuPanel`)가 **같은 섹션을 끼운다** — 두 진입점이 같은 조작·같은 순서를 갖게 한다.
 *
 * 각 라디오그룹의 접근 이름은 보이는 제목(文A 언어 / ◐ 테마)에서 온다 — 화면의 말과 접근
 * 이름이 같아야 한다.
 */
export function PreferencesSection({
    onLocaleSelect,
}: PreferencesSectionProps) {
    const t = useTranslations('widgets.layout');
    const { locale, select } = useLocaleSwitch();
    const languageHeadingId = useId();
    const themeHeadingId = useId();

    const onSelectLocale = (next: Locale) => {
        select(next);
        onLocaleSelect?.();
    };

    return (
        <div className="flex flex-col gap-1">
            <p id={languageHeadingId} className={HEADING_CLASS}>
                <TranslateIcon className="size-4 shrink-0" />
                {t('preferences.language')}
            </p>
            <LocaleRadioGroup
                locale={locale}
                labelledBy={languageHeadingId}
                onSelect={onSelectLocale}
            />
            <p id={themeHeadingId} className={HEADING_CLASS}>
                <ContrastIcon className="size-4 shrink-0" />
                {t('preferences.theme')}
            </p>
            <ThemeRadioGroup labelledBy={themeHeadingId} />
        </div>
    );
}
