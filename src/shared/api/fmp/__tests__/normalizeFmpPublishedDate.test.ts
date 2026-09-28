import { describe, expect, it } from 'vitest';
import { normalizeFmpPublishedDate } from '@/shared/api/fmp/normalizeFmpPublishedDate';

describe('normalizeFmpPublishedDate', () => {
    it('timezone이 없는 FMP 뉴스 시간을 New York summer time 기준 UTC로 변환한다', () => {
        expect(normalizeFmpPublishedDate('2026-05-06 07:35:21')).toBe(
            '2026-05-06T11:35:21.000Z'
        );
    });

    it('timezone이 없는 FMP 뉴스 시간을 New York standard time 기준 UTC로 변환한다', () => {
        expect(normalizeFmpPublishedDate('2026-01-06 07:35:21')).toBe(
            '2026-01-06T12:35:21.000Z'
        );
    });

    it('timezone이 포함된 값은 해당 instant를 그대로 ISO로 정규화한다', () => {
        expect(normalizeFmpPublishedDate('2026-05-06T07:35:21-04:00')).toBe(
            '2026-05-06T11:35:21.000Z'
        );
    });
});
