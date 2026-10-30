import { describe, expect, it } from 'vitest';
import {
    HOLDER_FILTERS,
    STATUS_CLASS,
    STATUS_MARK,
} from '../../utils/holderStatus';

describe('holderStatus', () => {
    it('들어온 쪽(신규·증가)은 성공, 나간 쪽(감소·청산)은 위험 톤을 쓴다', () => {
        expect(STATUS_CLASS.new).toBe(STATUS_CLASS.increased);
        expect(STATUS_CLASS.new).toContain('text-ui-success-text');
        expect(STATUS_CLASS.decreased).toBe(STATUS_CLASS.exited);
        expect(STATUS_CLASS.exited).toContain('text-ui-danger-text');
        expect(STATUS_CLASS.unchanged).toContain('text-secondary-300');
    });

    it('색과 별개로 상태마다 다른 방향 기호가 있다', () => {
        expect(STATUS_MARK).toEqual({
            new: '+',
            increased: '▲',
            decreased: '▼',
            exited: '✕',
            unchanged: '=',
        });
    });

    it('필터 버튼은 전체·신규·청산 순서다', () => {
        expect(HOLDER_FILTERS).toEqual(['all', 'new', 'exited']);
    });
});
