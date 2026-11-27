'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { LOCALE_NATIVE_LABEL, type Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import {
    ChevronDownIcon,
    ContrastIcon,
    TranslateIcon,
} from '@/shared/ui/StrokeIcons';
import { ThemeRadioGroup } from '@/shared/ui/ThemeRadioGroup';
import { useLocaleSwitch } from '../../hooks/useLocaleSwitch';
import { LocaleRadioGroup } from '../locale/LocaleRadioGroup';

type PreferenceRow = 'language' | 'theme';

interface RowProps {
    readonly icon: ReactNode;
    readonly label: string;
    /** 줄 오른쪽에 보이는 현재 선택(“한국어”, “시스템 설정”). */
    readonly value: string;
    readonly isOpen: boolean;
    readonly onToggle: () => void;
    readonly rowId: string;
    readonly panelId: string;
    readonly children: ReactNode;
}

function PreferenceRowItem({
    icon,
    label,
    value,
    isOpen,
    onToggle,
    rowId,
    panelId,
    children,
}: RowProps) {
    return (
        <div>
            <button
                id={rowId}
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span className="flex size-4 shrink-0 items-center justify-center text-secondary-400">
                    {icon}
                </span>
                <span className="flex-1">{label}</span>
                <span className="truncate text-xs text-secondary-400">
                    {value}
                </span>
                <ChevronDownIcon
                    className={cn(
                        'size-4 shrink-0 text-secondary-400 transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>
            {isOpen && (
                <div id={panelId} className="px-1 pb-1">
                    {children}
                </div>
            )}
        </div>
    );
}

interface PreferencesSectionProps {
    /**
     * 언어를 고른 뒤 부른다. 언어 전환은 라우터 이동이라 호스트 패널(아바타 메뉴)을 닫는다. 테마는
     * 그 자리에서 바로 칠해져 결과가 보이므로 패널을 열어 둔다.
     */
    readonly onLocaleSelect?: () => void;
}

/**
 * 회원 아바타 메뉴의 언어·테마 두 줄. 각 줄은 "아이콘 · 이름 · 현재 값 · ⌄"이고, 누르면 그 아래에
 * 선택지가 펼쳐진다(한 번에 한 줄만). 선택지를 늘 펼쳐 두면 언어 4 + 테마 3줄이 메뉴를 두 배로
 * 늘려, 자주 쓰지 않는 설정이 계정 링크·로그아웃을 밀어낸다.
 *
 * 아이콘(文A·◐)은 비회원 헤더 버튼(`HeaderPreferencesMenu`)과 같다 — 두 진입점이 같은 기호로
 * 같은 설정을 말한다. 펼친 라디오그룹의 접근 이름은 여는 줄(“언어 한국어”)에서 온다.
 */
export function PreferencesSection({
    onLocaleSelect,
}: PreferencesSectionProps) {
    const t = useTranslations('widgets.layout');
    const tOption = useTranslations('shared.ui.themeOption');
    const { locale, select } = useLocaleSwitch();
    const { preference } = useTheme();
    const [openRow, setOpenRow] = useState<PreferenceRow | null>(null);
    const baseId = useId();

    const toggle = (row: PreferenceRow) =>
        setOpenRow(current => (current === row ? null : row));

    const onSelectLocale = (next: Locale) => {
        select(next);
        onLocaleSelect?.();
    };

    return (
        <div className="flex flex-col">
            <PreferenceRowItem
                icon={<TranslateIcon className="size-4" />}
                label={t('preferences.language')}
                value={LOCALE_NATIVE_LABEL[locale]}
                isOpen={openRow === 'language'}
                onToggle={() => toggle('language')}
                rowId={`${baseId}-language`}
                panelId={`${baseId}-language-panel`}
            >
                <LocaleRadioGroup
                    locale={locale}
                    labelledBy={`${baseId}-language`}
                    onSelect={onSelectLocale}
                />
            </PreferenceRowItem>
            <PreferenceRowItem
                icon={<ContrastIcon className="size-4" />}
                label={t('preferences.theme')}
                value={tOption(preference)}
                isOpen={openRow === 'theme'}
                onToggle={() => toggle('theme')}
                rowId={`${baseId}-theme`}
                panelId={`${baseId}-theme-panel`}
            >
                <ThemeRadioGroup labelledBy={`${baseId}-theme`} />
            </PreferenceRowItem>
        </div>
    );
}
