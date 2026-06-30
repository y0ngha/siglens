import { kindLabel } from '../lib/kindLabel';
import type { ShareableKind } from '@/entities/shared-analysis';

describe('kindLabel', () => {
    const cases: Array<[ShareableKind, string]> = [
        ['chart', '차트 분석'],
        ['overall', '종합 분석'],
        ['news', '뉴스 분석'],
        ['fundamental', '펀더멘털 분석'],
        ['financials', '재무 분석'],
        ['congress', '의회 거래 분석'],
        ['options', '옵션 분석'],
        ['fear-greed', '공포·탐욕 지수'],
    ];

    it.each(cases)('kindLabel("%s") === "%s"', (kind, expected) => {
        expect(kindLabel(kind)).toBe(expected);
    });
});
