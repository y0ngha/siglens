import {
    buildSectorSignalQuery,
    withQuery,
} from '@/widgets/dashboard/utils/sectorSignalUrl';

const DEFAULT_SECTOR = 'XLK';

describe('buildSectorSignalQuery', () => {
    it('기본 섹터·기본 타임프레임이면 쿼리가 비어 있다', () => {
        expect(
            buildSectorSignalQuery('', {
                sector: 'XLK',
                timeframe: '1Day',
                defaultSector: DEFAULT_SECTOR,
            })
        ).toBe('');
    });

    it('기본이 아닌 섹터와 타임프레임을 쿼리에 쓴다', () => {
        expect(
            buildSectorSignalQuery('', {
                sector: 'XLF',
                timeframe: '1Hour',
                defaultSector: DEFAULT_SECTOR,
            })
        ).toBe('sector=XLF&timeframe=1Hour');
    });

    it('기본값으로 돌아오면 기존 쿼리에서 그 키를 지운다', () => {
        expect(
            buildSectorSignalQuery('sector=XLF&timeframe=1Hour', {
                sector: 'XLK',
                timeframe: '1Day',
                defaultSector: DEFAULT_SECTOR,
            })
        ).toBe('');
    });

    it('utm 같은 다른 쿼리는 보존한다', () => {
        expect(
            buildSectorSignalQuery('utm_source=news', {
                sector: 'XLF',
                timeframe: '1Day',
                defaultSector: DEFAULT_SECTOR,
            })
        ).toBe('utm_source=news&sector=XLF');
    });

    it('기본 섹터를 알 수 없으면 선택한 섹터를 항상 쿼리에 쓴다', () => {
        expect(
            buildSectorSignalQuery('', {
                sector: 'XLK',
                timeframe: '1Day',
                defaultSector: undefined,
            })
        ).toBe('sector=XLK');
    });
});

describe('withQuery', () => {
    it('쿼리가 있으면 경로 뒤에 ?로 붙인다', () => {
        expect(withQuery('/market', 'sector=XLF')).toBe('/market?sector=XLF');
    });

    it('쿼리가 비어 있으면 경로 그대로다', () => {
        expect(withQuery('/market', '')).toBe('/market');
    });
});
