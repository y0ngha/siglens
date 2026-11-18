'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/shared/hooks/useTheme';
import { LOCALE_NATIVE_LABEL } from '@/shared/i18n/locales';
import { ContrastIcon, TranslateIcon } from '@/shared/ui/StrokeIcons';
import { ThemeRadioGroup } from '@/shared/ui/ThemeRadioGroup';
import { useLocaleSwitch } from './hooks/useLocaleSwitch';
import { LocaleRadioGroup } from './ui/locale/LocaleRadioGroup';
import { PreferencePopover } from './ui/preferences/PreferencePopover';
import { HIDE_BELOW_PHONE_BAR } from './utils/phoneBarBreakpoint';

/**
 * 비회원의 언어·테마 진입점 — 文A(언어)와 ◐(테마) 아이콘 버튼 두 개, 각자의 팝오버.
 *
 * 회원은 같은 두 설정을 아바타 메뉴 안의 두 줄로 쓴다(`PreferencesSection`). 비회원에게 아바타
 * 모양을 쓰지 않는 이유는 로그인한 것처럼 읽히기 때문이다. 라벨 없이 아이콘만 두어 예전의
 * "🌐 한국어 / 🖥 테마"보다 좁다. 아이콘이 文A인 이유는 처음 온 해외 방문자가 화면 글자를 못
 * 읽어도 "언어"로 알아보는 모양이어야 하기 때문이다.
 *
 * 언어를 고르면 패널을 닫는다(페이지가 그 언어로 다시 열린다). 테마는 고른 결과가 바로 칠해져
 * 비교할 수 있게 열어 둔다.
 *
 * 폰 폭(30rem 미만)에서는 ◐를 헤더 줄에서 빼고 드로어로 옮긴다(`HeaderMobileMenu`) — 두 버튼을
 * 모두 세우면 맨 끝의 햄버거가 화면 밖으로 밀린다(`Header`의 "폭 예산"). 언어(文A)는 처음 온
 * 방문자가 찾아야 하는 쪽이라 남긴다.
 */
export function HeaderPreferencesMenu() {
    const t = useTranslations('widgets.layout');
    const tOption = useTranslations('shared.ui.themeOption');
    const { locale, select } = useLocaleSwitch();
    const { preference } = useTheme();

    return (
        <div className="flex items-center">
            <PreferencePopover
                icon={<TranslateIcon className="size-5 shrink-0" />}
                label={t('preferences.languageCurrent', {
                    v0: LOCALE_NATIVE_LABEL[locale],
                })}
                heading={t('preferences.language')}
            >
                {({ headingId, close }) => (
                    <LocaleRadioGroup
                        locale={locale}
                        labelledBy={headingId}
                        onSelect={next => {
                            select(next);
                            close();
                        }}
                    />
                )}
            </PreferencePopover>
            <div className={HIDE_BELOW_PHONE_BAR}>
                <PreferencePopover
                    icon={<ContrastIcon className="size-5 shrink-0" />}
                    label={t('preferences.themeCurrent', {
                        v0: tOption(preference),
                    })}
                    heading={t('preferences.theme')}
                >
                    {({ headingId }) => (
                        <ThemeRadioGroup labelledBy={headingId} />
                    )}
                </PreferencePopover>
            </div>
        </div>
    );
}
