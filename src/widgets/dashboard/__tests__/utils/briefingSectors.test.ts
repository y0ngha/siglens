import { filterKnownSectors } from '@/widgets/dashboard/utils/briefingSectors';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { TEST_SCOPE } from '../helpers/testScope';

describe('filterKnownSectors', () => {
    it('이 시장의 섹터명만 심볼과 함께 남긴다', () => {
        expect(filterKnownSectors(['기술', '금융'], TEST_SCOPE)).toEqual([
            { symbol: 'XLK', name: '기술' },
            { symbol: 'XLF', name: '금융' },
        ]);
    });

    it('이 시장에 없는 이름은 걸러낸다', () => {
        expect(filterKnownSectors(['기술', '지어낸섹터'], TEST_SCOPE)).toEqual([
            { symbol: 'XLK', name: '기술' },
        ]);
    });

    it('티커로 적힌 값은 이름이 아니라서 걸러낸다', () => {
        expect(filterKnownSectors(['XLK'], TEST_SCOPE)).toEqual([]);
    });

    it('다른 시장의 섹터명은 걸러낸다', () => {
        expect(
            filterKnownSectors(['기술', '에너지'], KR_DASHBOARD_SCOPE)
        ).toEqual([]);
    });

    it('입력 순서를 유지한다', () => {
        expect(
            filterKnownSectors(['금융', '기술'], TEST_SCOPE).map(s => s.symbol)
        ).toEqual(['XLF', 'XLK']);
    });

    it('빈 입력은 빈 배열이다', () => {
        expect(filterKnownSectors([], TEST_SCOPE)).toEqual([]);
    });
});
