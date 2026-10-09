// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimMeterShown } from '@/shared/lib/funnel/meterShownDedupe';
import { LOCAL_STORAGE_FUNNEL_METER_SHOWN_KEY } from '@/shared/lib/storageKeys';

const DAY1 = new Date('2026-10-18T03:00:00Z');
const BEFORE_MIDNIGHT = new Date('2026-10-18T14:59:59Z');
const AFTER_MIDNIGHT = new Date('2026-10-18T15:00:00Z');

describe('claimMeterShown', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('같은 (종목, 상태)는 같은 KST 날짜에 한 번만 true다', () => {
        expect(claimMeterShown('AAPL', 'revealed', DAY1)).toBe(true);
        expect(claimMeterShown('AAPL', 'revealed', DAY1)).toBe(false);
        expect(claimMeterShown('aapl', 'revealed', BEFORE_MIDNIGHT)).toBe(
            false
        );
    });

    it('종목이나 상태가 다르면 따로 센다', () => {
        expect(claimMeterShown('AAPL', 'revealed', DAY1)).toBe(true);
        expect(claimMeterShown('MSFT', 'revealed', DAY1)).toBe(true);
        expect(claimMeterShown('AAPL', 'exhausted', DAY1)).toBe(true);
    });

    it('KST 자정을 넘기면 다시 true다', () => {
        expect(claimMeterShown('AAPL', 'revealed', BEFORE_MIDNIGHT)).toBe(true);
        expect(claimMeterShown('AAPL', 'revealed', AFTER_MIDNIGHT)).toBe(true);
    });

    it('깨진 저장값은 무시하고 새로 기록한다', () => {
        window.localStorage.setItem(
            LOCAL_STORAGE_FUNNEL_METER_SHOWN_KEY,
            '{not json'
        );
        expect(claimMeterShown('AAPL', 'revealed', DAY1)).toBe(true);
    });

    it('저장소가 막혀 있으면 페이지 수명 메모리로 중복을 막고 던지지 않는다', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const later = new Date('2026-11-02T03:00:00Z');
        expect(claimMeterShown('NVDA', 'exhausted', later)).toBe(true);
        expect(claimMeterShown('NVDA', 'exhausted', later)).toBe(false);
    });
});
