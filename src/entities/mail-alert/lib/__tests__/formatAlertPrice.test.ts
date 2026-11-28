import { describe, expect, it } from 'vitest';
import { formatAlertPrice } from '@/entities/mail-alert/lib/formatAlertPrice';

describe('formatAlertPrice', () => {
    it('미국 종목은 로케일과 무관하게 종목 화면과 같은 달러 표기다', () => {
        expect(formatAlertPrice(126.98, 'us')).toBe('$126.98');
        expect(formatAlertPrice(180, 'us')).toBe('$180.00');
    });

    it('한국 종목은 원화 정수다', () => {
        expect(formatAlertPrice(71_500, 'kr')).toBe('₩71,500');
    });
});
