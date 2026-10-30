import type { Weekday } from '@/entities/email-report/model';
import {
    SEND_HOURS,
    detectBrowserTimeZone,
    resolveInitialTimezone,
    toggleWeekday,
} from '@/features/email-report-settings/lib/settingsForm';

describe('toggleWeekday', () => {
    it('없는 요일은 뒤에 붙인다', () => {
        expect(toggleWeekday([3], 1)).toEqual([3, 1]);
    });

    it('있는 요일은 뺀다', () => {
        expect(toggleWeekday([1, 3], 1)).toEqual([3]);
    });

    it('마지막 남은 요일은 빼지 않고 같은 배열을 돌려준다', () => {
        const only: Weekday[] = [5];
        expect(toggleWeekday(only, 5)).toBe(only);
    });
});

describe('resolveInitialTimezone', () => {
    it('저장된 설정은 저장된 타임존을 유지한다', () => {
        expect(
            resolveInitialTimezone(
                { isSaved: true, timezone: 'Europe/Berlin' },
                'Pacific/Auckland'
            )
        ).toBe('Europe/Berlin');
    });

    it('처음 설정하면 브라우저 타임존을 쓴다', () => {
        expect(
            resolveInitialTimezone(
                { isSaved: false, timezone: 'Asia/Seoul' },
                'Pacific/Auckland'
            )
        ).toBe('Pacific/Auckland');
    });

    it('브라우저 타임존을 모르면 기본값을 쓴다', () => {
        expect(
            resolveInitialTimezone(
                { isSaved: false, timezone: 'Asia/Seoul' },
                null
            )
        ).toBe('Asia/Seoul');
    });
});

describe('detectBrowserTimeZone', () => {
    afterEach(() => vi.restoreAllMocks());

    it('Intl이 알려 주는 타임존을 돌려준다', () => {
        const real = Intl.DateTimeFormat.prototype.resolvedOptions;
        vi.spyOn(
            Intl.DateTimeFormat.prototype,
            'resolvedOptions'
        ).mockImplementation(function (this: Intl.DateTimeFormat) {
            return { ...real.call(this), timeZone: 'America/Chicago' };
        });
        expect(detectBrowserTimeZone()).toBe('America/Chicago');
    });

    it('Intl이 던지면 null', () => {
        vi.spyOn(
            Intl.DateTimeFormat.prototype,
            'resolvedOptions'
        ).mockImplementation(() => {
            throw new RangeError('unsupported');
        });
        expect(detectBrowserTimeZone()).toBeNull();
    });
});

describe('SEND_HOURS', () => {
    it('0시부터 23시까지 24개 정각이다', () => {
        expect(SEND_HOURS).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
            19, 20, 21, 22, 23,
        ]);
    });
});
