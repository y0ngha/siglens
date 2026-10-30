/**
 * Style and i18n-key lookups for the AI analysis tone and signal badges.
 */
import type { OptionsSignalKind, OptionsTone } from '@y0ngha/siglens-core';

/** Tailwind classes that style one badge. */
export interface BadgeClasses {
    text: string;
    bg: string;
    border: string;
}

/** OptionsTone → `shared.enumLabel.optionsTone` 카탈로그 키. */
export const TONE_LABEL_KEY: Record<OptionsTone, string> = {
    bullish: 'optionsTone.bullish',
    bearish: 'optionsTone.bearish',
    cautious: 'optionsTone.cautious',
    neutral: 'optionsTone.neutral',
};

/**
 * 배지 **텍스트**는 `-text` 변형을 쓴다. `chart-bullish`/`chart-bearish`/`ui-warning`은
 * 그래픽(3:1) 기준으로 튜닝된 값이라, 자기 `/10` 틴트 위 10px 글씨로 쓰면 라이트에서
 * 3.99~4.14:1로 AA(4.5)에 미달한다(실측). 채움·보더는 그래픽이므로 기본 토큰을 쓴다.
 */
export const TONE_CLASS: Record<OptionsTone, BadgeClasses> = {
    bullish: {
        text: 'text-ui-success-text',
        bg: 'bg-chart-bullish/10',
        border: 'border-chart-bullish/30',
    },
    bearish: {
        text: 'text-ui-danger-text',
        bg: 'bg-chart-bearish/10',
        border: 'border-chart-bearish/30',
    },
    cautious: {
        text: 'text-ui-warning-text',
        bg: 'bg-ui-warning/10',
        border: 'border-ui-warning/30',
    },
    neutral: {
        text: 'text-secondary-400',
        bg: 'bg-secondary-700/40',
        border: 'border-secondary-600',
    },
};

/** Signal kinds reuse the tone palette; `volatility` reads as caution. */
export const SIGNAL_KIND_CLASS: Record<OptionsSignalKind, BadgeClasses> = {
    bullish: TONE_CLASS.bullish,
    bearish: TONE_CLASS.bearish,
    volatility: TONE_CLASS.cautious,
    neutral: TONE_CLASS.neutral,
};

/** OptionsSignalKind → `shared.enumLabel.optionsSignalKind` 카탈로그 키. */
export const SIGNAL_KIND_LABEL_KEY: Record<OptionsSignalKind, string> = {
    bullish: 'optionsSignalKind.bullish',
    bearish: 'optionsSignalKind.bearish',
    volatility: 'optionsSignalKind.volatility',
    neutral: 'optionsSignalKind.neutral',
};
