import { describe, expect, it } from 'vitest';
import {
    normalizeQuotaIp,
    UNKNOWN_QUOTA_IP,
} from '@/entities/analysis/lib/normalizeQuotaIp';

describe('normalizeQuotaIp', () => {
    it('keeps IPv4 as-is', () => {
        expect(normalizeQuotaIp(' 203.0.113.9 ')).toBe('203.0.113.9');
    });

    it('folds every address of one IPv6 /64 into the same key', () => {
        const a = normalizeQuotaIp('2001:db8:abcd:12:1111:2222:3333:4444');
        const b = normalizeQuotaIp('2001:0DB8:ABCD:0012:ffff:0:0:1');
        expect(a).toBe('2001:db8:abcd:12::/64');
        expect(b).toBe(a);
    });

    it('separates different /64 prefixes', () => {
        expect(normalizeQuotaIp('2001:db8:abcd:13::1')).not.toBe(
            normalizeQuotaIp('2001:db8:abcd:12::1')
        );
    });

    it('expands :: compression and drops zone ids', () => {
        expect(normalizeQuotaIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
        expect(normalizeQuotaIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    });

    it('treats IPv4-mapped IPv6 (dotted and hex forms) as the IPv4 address', () => {
        expect(normalizeQuotaIp('::ffff:203.0.113.9')).toBe('203.0.113.9');
        expect(normalizeQuotaIp('::FFFF:cb00:7109')).toBe('203.0.113.9');
    });

    it.each([
        'unknown',
        '',
        '   ',
        'not-an-ip',
        '1:2:3',
        '999.1.1.1',
        '1::2::3',
    ])('maps %j to the shared unknown bucket', raw => {
        expect(normalizeQuotaIp(raw)).toBe(UNKNOWN_QUOTA_IP);
    });
});
