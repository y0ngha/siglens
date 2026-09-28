import { describe, expect, it } from 'vitest';

import { normalizeLabel } from '@/features/ticker-search/lib/normalizeLabel';

/**
 * `onSelect`로 나가는 라벨의 단일 정규화 지점. 빈 문자열·공백뿐인 라벨은
 * 심볼로 대체돼야 최근 검색에 빈 이름이 남지 않는다.
 */
describe('normalizeLabel', () => {
    describe('when label is missing or blank', () => {
        it('label이 undefined이면 symbol로 대체한다', () => {
            expect(normalizeLabel(undefined, 'AAPL')).toBe('AAPL');
        });

        it('label이 빈 문자열이면 symbol로 대체한다', () => {
            expect(normalizeLabel('', 'AAPL')).toBe('AAPL');
        });

        it('label이 공백만 있으면 symbol로 대체한다', () => {
            expect(normalizeLabel('   ', 'AAPL')).toBe('AAPL');
        });
    });

    describe('when label is present', () => {
        it('앞뒤 공백을 제거한 label을 반환한다', () => {
            expect(normalizeLabel('  애플  ', 'AAPL')).toBe('애플');
        });

        it('공백이 없으면 label을 그대로 반환한다', () => {
            expect(normalizeLabel('애플', 'AAPL')).toBe('애플');
        });
    });
});
