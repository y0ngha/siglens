import { describe, expect, it } from 'vitest';
import { searchGuide } from '@/shared/lib/guideSearch';
import type { GuideCategory } from '../../types';
import { termsFirst } from '../termsFirst';

function entry(slug: string, title: string, category: GuideCategory) {
    return { slug, title, category, aliases: [], summary: '' };
}

describe('termsFirst', () => {
    it('howto를 뒤로 보내고 나머지는 입력 순서를 지킨다', () => {
        const howto = entry(
            'golden-cross-trading',
            '골든크로스 매매법',
            'howto'
        );
        const rsi = entry('rsi', 'RSI', 'indicators');
        const hammer = entry('hammer', '망치형', 'candlesticks');
        expect(termsFirst([howto, rsi, hammer])).toEqual([rsi, hammer, howto]);
    });

    it('같은 순위(접두 일치)에서 용어 항목이 howto보다 먼저 검색된다', () => {
        const howto = entry(
            'golden-cross-trading',
            '골든크로스 매매법',
            'howto'
        );
        const term = entry('golden-cross', '골든크로스 신호', 'strategies');
        expect(searchGuide(termsFirst([howto, term]), '골든', 10)).toEqual([
            term,
            howto,
        ]);
    });

    it('글 제목 완전 일치는 howto가 맨 앞이다', () => {
        const howto = entry('rsi-how-to-read', 'RSI 보는 법', 'howto');
        const term = entry('rsi', 'RSI', 'indicators');
        expect(
            searchGuide(termsFirst([howto, term]), 'RSI 보는 법', 10)
        ).toEqual([howto]);
    });
});
