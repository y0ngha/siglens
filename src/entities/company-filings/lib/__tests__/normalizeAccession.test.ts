import { describe, expect, it } from 'vitest';
import { normalizeAccession } from '../normalizeAccession';

describe('normalizeAccession', () => {
    it('대시 형식은 그대로(앞뒤 공백만 제거)', () => {
        expect(normalizeAccession('0001193125-26-461016')).toBe(
            '0001193125-26-461016'
        );
        expect(normalizeAccession('  0001193125-26-461016\n')).toBe(
            '0001193125-26-461016'
        );
    });

    it('대시 없는 18자리는 대시를 넣는다', () => {
        expect(normalizeAccession('000119312526461016')).toBe(
            '0001193125-26-461016'
        );
    });

    it.each([
        '',
        '   ',
        'garbage',
        '0001193125-26-46101',
        '0001193125-26-4610166',
        '00011931252646101',
        '0001193125_26_461016',
        '../0001193125-26-461016',
    ])('%j는 null', raw => {
        expect(normalizeAccession(raw)).toBeNull();
    });
});
