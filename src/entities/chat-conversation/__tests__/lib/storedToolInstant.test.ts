import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    parseStoredToolInstant,
    toStoredMinuteMs,
} from '@/entities/chat-conversation/lib/storedToolInstant';

/**
 * 일반 이름 라벨("China Time"·"United Kingdom Time")은 ICU 버전에 따라 문구가 바뀔 수 있어 여기 적지 않는다 — 그
 * 시간대들은 실제 core 출력을 되읽는 `storedAnalysisTimestamps.test.ts`가 맡는다.
 */
describe('parseStoredToolInstant', () => {
    it.each([
        ['KST', '2026-11-28 15:44 KST', '2026-11-28T06:44:00.000Z'],
        [
            'KST 자정을 넘긴 날짜',
            '2026-11-29 00:20 KST',
            '2026-11-28T15:20:00.000Z',
        ],
        ['JST', '2026-11-28 15:44 JST', '2026-11-28T06:44:00.000Z'],
        ['ET 겨울(EST)', '2026-11-28 01:44 EST', '2026-11-28T06:44:00.000Z'],
        ['ET 여름(EDT)', '2026-07-01 10:05 EDT', '2026-07-01T14:05:00.000Z'],
        ['PT 여름(PDT)', '2026-07-01 07:05 PDT', '2026-07-01T14:05:00.000Z'],
        ['UTC', '2026-11-28 06:44 UTC', '2026-11-28T06:44:00.000Z'],
        ['GMT(런던 겨울)', '2026-11-28 06:44 GMT', '2026-11-28T06:44:00.000Z'],
    ])('%s', (_label, stored, iso) => {
        expect(parseStoredToolInstant(stored)).toBe(iso);
    });

    it.each([
        [
            'GMT+9(Etc/GMT-9)',
            '2026-11-28 15:44 GMT+9',
            '2026-11-28T06:44:00.000Z',
        ],
        [
            'GMT-5(Etc/GMT+5)',
            '2026-11-28 01:44 GMT-5',
            '2026-11-28T06:44:00.000Z',
        ],
        ['GMT+14', '2026-11-28 20:44 GMT+14', '2026-11-28T06:44:00.000Z'],
        ['GMT-3:30', '2026-11-28 03:14 GMT-3:30', '2026-11-28T06:44:00.000Z'],
        ['GMT+5:45', '2026-11-28 12:29 GMT+5:45', '2026-11-28T06:44:00.000Z'],
    ])('오프셋 라벨 %s는 그 오프셋으로 읽는다', (_label, stored, iso) => {
        expect(parseStoredToolInstant(stored)).toBe(iso);
    });

    it('범위를 벗어난 오프셋 라벨은 읽지 않는다', () => {
        expect(parseStoredToolInstant('2026-11-28 15:44 GMT+15')).toBeNull();
        expect(parseStoredToolInstant('2026-11-28 15:44 GMT+9:60')).toBeNull();
    });

    it('서머타임이 끝나는 날 두 번 오는 01:30은 라벨로 가른다', () => {
        expect(parseStoredToolInstant('2026-11-01 01:30 EDT')).toBe(
            '2026-11-01T05:30:00.000Z'
        );
        expect(parseStoredToolInstant('2026-11-01 01:30 EST')).toBe(
            '2026-11-01T06:30:00.000Z'
        );
    });

    it('서머타임이 시작한 직후의 시각을 읽는다', () => {
        expect(parseStoredToolInstant('2026-03-08 03:30 EDT')).toBe(
            '2026-03-08T07:30:00.000Z'
        );
    });

    it('라벨이 그 시각의 오프셋을 정한다 — 여름의 EST는 연중 EST인 곳(파나마 등)의 UTC-5다', () => {
        expect(parseStoredToolInstant('2026-07-01 10:05 EST')).toBe(
            '2026-07-01T15:05:00.000Z'
        );
    });

    it('서머타임 시작으로 건너뛴 시각(02:30 EDT)은 core가 만들 수 없어 읽지 않는다', () => {
        expect(parseStoredToolInstant('2026-03-08 02:30 EDT')).toBeNull();
    });

    it.each([
        ['Z', '2026-11-18T14:00:00.000Z', '2026-11-18T14:00:00.000Z'],
        ['초 없는 Z', '2026-11-18T14:00Z', '2026-11-18T14:00:00.000Z'],
        ['오프셋', '2026-11-18T23:00:00+09:00', '2026-11-18T14:00:00.000Z'],
    ])('ISO 순간(%s)은 그대로 정규화한다', (_label, stored, iso) => {
        expect(parseStoredToolInstant(stored)).toBe(iso);
    });

    it.each([
        ['날짜만', '2026-11-18'],
        ['시간대 없는 ISO', '2026-11-18T14:00:00'],
        ['모르는 라벨', '2026-11-28 15:44 XYZ'],
        ['라벨 없음', '2026-11-28 15:44'],
        ['넘친 월', '2026-13-01 10:00 KST'],
        ['넘친 시', '2026-11-28 25:00 KST'],
        ['한국어', '어제'],
        ['빈 문자열', ''],
    ])('%s → null', (_label, stored) => {
        expect(parseStoredToolInstant(stored)).toBeNull();
    });
});

describe('toStoredMinuteMs', () => {
    it('초 이하를 버린다', () => {
        expect(toStoredMinuteMs('2026-11-14T10:00:37.512Z')).toBe(
            Date.parse('2026-11-14T10:00:00.000Z')
        );
    });

    it('읽을 수 없으면 NaN', () => {
        expect(toStoredMinuteMs('not a date')).toBeNaN();
    });
});

describe('parseStoredToolInstant — 훑기 비용', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('맞는 시간대가 없던 값은 다시 와도 시간대를 다시 훑지 않는다', () => {
        const scan = vi.spyOn(Intl, 'supportedValuesOf');
        expect(parseStoredToolInstant('2026-11-28 15:44 ZZQ')).toBeNull();
        expect(scan).toHaveBeenCalledTimes(1);
        expect(parseStoredToolInstant('2026-11-28 15:44 ZZQ')).toBeNull();
        expect(scan).toHaveBeenCalledTimes(1);
    });

    it('core가 만들 수 없는 모양의 라벨은 훑지 않는다', () => {
        const scan = vi.spyOn(Intl, 'supportedValuesOf');
        expect(
            parseStoredToolInstant('2026-11-28 15:44 not a zone')
        ).toBeNull();
        expect(
            parseStoredToolInstant(`2026-11-28 15:44 ${'A'.repeat(500)} Time`)
        ).toBeNull();
        expect(scan).not.toHaveBeenCalled();
    });

    it('건너뛴 시각으로 실패해도 같은 라벨의 다른 값은 읽는다', () => {
        expect(parseStoredToolInstant('2026-03-08 02:45 EDT')).toBeNull();
        expect(parseStoredToolInstant('2026-03-08 03:45 EDT')).toBe(
            '2026-03-08T07:45:00.000Z'
        );
    });
});
