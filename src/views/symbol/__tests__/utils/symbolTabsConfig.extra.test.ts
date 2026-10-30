import { describe, it, expect } from 'vitest';
import {
    SYMBOL_SUB_TAB_KEYS,
    TABS,
    subTabOfSegment,
    tabsFor,
} from '@/views/symbol/utils/symbolTabsConfig';

describe('tabsFor', () => {
    it('returns all tabs for us-equity', () => {
        expect(tabsFor('us-equity').map(t => t.key)).toEqual(
            TABS.map(t => t.key)
        );
    });

    it('returns only crypto-applicable tabs for crypto', () => {
        expect(tabsFor('crypto').map(t => t.key)).toEqual([
            'chart',
            'news',
            'fear-greed',
            'overall',
            'position',
        ]);
    });
});

describe('subTabOfSegment', () => {
    it('차트 세그먼트(null)는 하위 탭이 아니다', () => {
        expect(subTabOfSegment(null)).toBeNull();
    });

    it('하위 탭 세그먼트는 그 키를 돌려준다', () => {
        expect(subTabOfSegment('fear-greed')).toBe('fear-greed');
    });

    it('알 수 없는 세그먼트와 차트 키 문자열은 null이다', () => {
        expect(subTabOfSegment('unknown')).toBeNull();
        expect(subTabOfSegment('chart')).toBeNull();
    });

    it('SYMBOL_SUB_TAB_KEYS의 모든 키를 하위 탭으로 인정한다', () => {
        expect(SYMBOL_SUB_TAB_KEYS.map(subTabOfSegment)).toEqual([
            ...SYMBOL_SUB_TAB_KEYS,
        ]);
    });
});
