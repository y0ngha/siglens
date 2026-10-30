import {
    INDEX_GRID_CLASS,
    sectorGridClass,
} from '@/widgets/dashboard/utils/marketGridClasses';

describe('INDEX_GRID_CLASS', () => {
    it('모바일 2열, sm 이상 4열이다', () => {
        expect(INDEX_GRID_CLASS).toBe('grid grid-cols-2 gap-2 sm:grid-cols-4');
    });
});

describe('sectorGridClass', () => {
    it('3개짜리 그룹은 모바일 2열, sm 이상 3열이다', () => {
        expect(sectorGridClass(3)).toBe(
            'grid grid-cols-2 gap-2 sm:grid-cols-3'
        );
    });

    it.each([0, 1, 2, 4, 5, 8])(
        '%i개짜리 그룹은 모바일 2열, sm 이상 4열이다',
        count => {
            expect(sectorGridClass(count)).toBe(
                'grid grid-cols-2 gap-2 sm:grid-cols-4'
            );
        }
    );
});
