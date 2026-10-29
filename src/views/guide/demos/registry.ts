import { CANDLESTICK_DEMOS } from '@/views/guide/demos/candlesticks';
import { CHART_PATTERN_DEMOS } from '@/views/guide/demos/chartPatterns';
import { INDICATOR_DEMOS } from '@/views/guide/demos/indicators';
import { STRATEGY_DEMOS } from '@/views/guide/demos/strategies';
import type { GuideDemo } from '@/views/guide/demos/types';

function demoTable(
    category: string
): Readonly<Record<string, () => GuideDemo>> | null {
    switch (category) {
        case 'candlesticks':
            return CANDLESTICK_DEMOS;
        case 'chart-patterns':
            return CHART_PATTERN_DEMOS;
        case 'indicators':
            return INDICATOR_DEMOS;
        case 'strategies':
            return STRATEGY_DEMOS;
        default:
            return null;
    }
}

/**
 * 가이드 항목의 데모를 돌려준다. 데모가 없으면 null (페이지는 차트 영역을 생략한다).
 * 카테고리는 entities/guide의 `GuideCategory`와 같은 문자열이다.
 */
export function getGuideDemo(category: string, slug: string): GuideDemo | null {
    const table = demoTable(category);
    if (table === null || !Object.hasOwn(table, slug)) return null;
    return table[slug]();
}
