import {
    KR_CYCLICAL_DEFENSIVE_GROUP_LABEL,
    KR_GROWTH_TECH_GROUP_LABEL,
} from '@/shared/config/dashboard-tickers-kr';
import {
    panelHeadingKey,
    sectorGroupLabelKey,
} from '@/widgets/dashboard/utils/marketLabelKeys';

describe('panelHeadingKey', () => {
    it.each([
        ['us', 'panelHeading.us'],
        ['kr', 'panelHeading.kr'],
    ] as const)('%s의 제목 키는 %s다', (scopeId, key) => {
        expect(panelHeadingKey(scopeId)).toBe(key);
    });

    it('이 패널을 쓰는 화면이 없는 crypto는 키가 없다', () => {
        expect(panelHeadingKey('crypto')).toBeUndefined();
    });
});

describe('sectorGroupLabelKey', () => {
    it.each([
        ['성장', 'sectorGroup.growth'],
        ['경기민감', 'sectorGroup.cyclical'],
        ['방어', 'sectorGroup.defensive'],
        [KR_GROWTH_TECH_GROUP_LABEL, 'sectorGroup.growthTech'],
        [KR_CYCLICAL_DEFENSIVE_GROUP_LABEL, 'sectorGroup.cyclicalDefensive'],
    ])('%s 라벨은 %s 키로 이어진다', (label, key) => {
        expect(sectorGroupLabelKey(label)).toBe(key);
    });

    it('표에 없는 라벨은 undefined다', () => {
        expect(sectorGroupLabelKey('알 수 없는 그룹')).toBeUndefined();
    });
});
