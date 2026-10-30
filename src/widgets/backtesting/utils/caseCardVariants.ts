import type { BacktestSignalResult } from '@y0ngha/siglens-core';

interface CaseCardVariant {
    article: string;
    badge: string;
    returnText: string;
    aiSummary: string;
    tag: string;
}

/**
 * 카드 결과(수익/손실)별 색 클래스. 이긴 사례는 기본 카드 면 그대로(투명 경계)
 * 두고 진 사례만 색 경계로 구분한다.
 */
export const CASE_CARD_VARIANT: Record<BacktestSignalResult, CaseCardVariant> =
    {
        win: {
            article: '',
            badge: 'bg-secondary-700 text-primary-400',
            returnText: 'text-ui-success-text',
            aiSummary: 'border-chart-bullish',
            tag: 'border border-primary-900/50 bg-primary-950/40 text-primary-400',
        },
        loss: {
            article: 'border-chart-bearish/20',
            badge: 'bg-chart-bearish/10 text-ui-danger-text',
            returnText: 'text-ui-danger-text',
            aiSummary: 'border-ui-warning',
            tag: 'border border-ui-warning/30 bg-ui-warning/10 text-ui-warning-text',
        },
    };
