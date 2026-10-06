import { describe, expect, it } from 'vitest';
import {
    isStorableCoverage,
    sessionCoverage,
} from '@/shared/lib/sessionCoverage';

const CURRENT = '2026-10-06';
const PREVIOUS = '2026-10-05';

describe('sessionCoverage', () => {
    it.each([
        ['2026-10-06', 'complete'],
        // 장중 형성 봉 등 키보다 뒤 — 키의 세션에는 도달했다.
        ['2026-10-07', 'complete'],
        // 정확히 직전 거래일 — EOD 발행 지연·체결 없음·휴장일 표 공백.
        ['2026-10-05', 'lagging'],
        // 직전 거래일보다도 오래됨 — 거래 정지·상장폐지.
        ['2026-10-02', 'dormant'],
        ['2025-01-02', 'dormant'],
    ] as const)('마지막 날짜 %s → %s', (lastDate, expected) => {
        expect(sessionCoverage(lastDate, CURRENT, PREVIOUS)).toBe(expected);
    });

    it('데이터가 없으면 empty', () => {
        expect(sessionCoverage(null, CURRENT, PREVIOUS)).toBe('empty');
    });
});

describe('isStorableCoverage', () => {
    it('complete·dormant만 저장한다 — lagging은 한 세션 뒤처진 값, empty는 장애일 수 있다', () => {
        expect(isStorableCoverage('complete')).toBe(true);
        expect(isStorableCoverage('dormant')).toBe(true);
        expect(isStorableCoverage('lagging')).toBe(false);
        expect(isStorableCoverage('empty')).toBe(false);
    });
});
