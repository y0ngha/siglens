import { describe, expect, it } from 'vitest';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { requestedTimeframeOf } from '@/shared/config/marketProfile/requestedTimeframe';

const US = getDescriptor('us-equity').allowedTimeframes;
const KR = getDescriptor('kr-equity').allowedTimeframes;
const CRYPTO = getDescriptor('crypto').allowedTimeframes;

describe('requestedTimeframeOf', () => {
    it('프로필이 허용하는 유효 프레임은 그대로 낸다', () => {
        expect(requestedTimeframeOf('4Hour', US)).toBe('4Hour');
        expect(requestedTimeframeOf('1Week', KR)).toBe('1Week');
        expect(requestedTimeframeOf('1Hour', CRYPTO)).toBe('1Hour');
    });

    it('프로필이 허용하지 않는 프레임은 기본 프레임이다(KR 4Hour, 크립토 15Min)', () => {
        expect(requestedTimeframeOf('4Hour', KR)).toBe('1Day');
        expect(requestedTimeframeOf('15Min', CRYPTO)).toBe('1Day');
    });

    it('유효하지 않거나 없는 값은 기본 프레임이다', () => {
        expect(requestedTimeframeOf('1Month', US)).toBe('1Day');
        expect(requestedTimeframeOf(null, US)).toBe('1Day');
        expect(requestedTimeframeOf(undefined, US)).toBe('1Day');
    });
});
