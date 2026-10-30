import { describe, expect, it } from 'vitest';
import type { RelatedSymbol } from '@/shared/config/relatedSymbols';
import {
    chipNameFor,
    groupRelatedByLabel,
} from '../../utils/relatedSymbolChips';

function item(
    symbol: string,
    label: string,
    koreanName?: string
): RelatedSymbol {
    return {
        symbol,
        displayTicker: symbol,
        reason: 'theme',
        label,
        koreanName,
    };
}

describe('groupRelatedByLabel', () => {
    it('처음 등장한 캡션 순서대로 묶고 그룹 안 순서를 지킨다', () => {
        const related = [
            item('NVDA', 'theme'),
            item('AMD', 'ring'),
            item('TSM', 'theme'),
        ];
        expect(groupRelatedByLabel(related)).toEqual([
            { label: 'theme', items: [related[0], related[2]] },
            { label: 'ring', items: [related[1]] },
        ]);
    });

    it('빈 목록이면 빈 그룹이다', () => {
        expect(groupRelatedByLabel([])).toEqual([]);
    });
});

describe('chipNameFor', () => {
    const nvda = item('NVDA', 'theme', '엔비디아');

    it('ko + DB 미스면 큐레이션 한글명을 쓴다', () => {
        expect(chipNameFor(null, nvda, 'ko')).toBe('엔비디아');
    });

    it('비-ko + DB 미스면 큐레이션 한글명을 쓰지 않는다', () => {
        expect(chipNameFor(null, nvda, 'en')).toBeUndefined();
    });

    it('ko는 DB 한글명을 큐레이션보다 앞세운다', () => {
        expect(
            chipNameFor(
                { name: 'NVIDIA Corp', koreanName: '엔비디아(DB)' },
                nvda,
                'ko'
            )
        ).toBe('엔비디아(DB)');
    });

    it('비-ko는 DB 영문명을 쓴다', () => {
        expect(
            chipNameFor(
                { name: 'NVIDIA Corp', koreanName: '엔비디아(DB)' },
                nvda,
                'en'
            )
        ).toBe('NVIDIA Corp');
    });
});
