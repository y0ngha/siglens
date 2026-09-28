import {
    cachedDateTimeFormat,
    cachedNumberFormat,
} from '@/shared/lib/intlFormatCache';

describe('cachedNumberFormat', () => {
    it('같은 로케일·옵션이면 같은 인스턴스를 재사용한다', () => {
        const a = cachedNumberFormat('en-US', { maximumFractionDigits: 1 });
        const b = cachedNumberFormat('en-US', { maximumFractionDigits: 1 });
        expect(a).toBe(b);
    });

    it('로케일이나 옵션이 다르면 다른 인스턴스를 만든다', () => {
        const base = cachedNumberFormat('en-US', { maximumFractionDigits: 1 });
        expect(
            cachedNumberFormat('ko-KR', { maximumFractionDigits: 1 })
        ).not.toBe(base);
        expect(
            cachedNumberFormat('en-US', { maximumFractionDigits: 2 })
        ).not.toBe(base);
    });

    it('옵션을 생략하면 기본 옵션 포매터를 돌려준다', () => {
        expect(cachedNumberFormat('en-US').format(1234.5)).toBe('1,234.5');
    });

    it('옵션을 그대로 적용한다', () => {
        expect(
            cachedNumberFormat('en-US', {
                signDisplay: 'always',
                maximumFractionDigits: 1,
            }).format(2)
        ).toBe('+2');
    });
});

describe('cachedDateTimeFormat', () => {
    it('같은 로케일·옵션이면 같은 인스턴스를 재사용한다', () => {
        const options = { timeZone: 'UTC', month: 'short' } as const;
        expect(cachedDateTimeFormat('en-US', options)).toBe(
            cachedDateTimeFormat('en-US', { ...options })
        );
    });

    it('옵션이 다르면 다른 인스턴스를 만든다', () => {
        expect(cachedDateTimeFormat('en-US', { timeZone: 'UTC' })).not.toBe(
            cachedDateTimeFormat('en-US', { timeZone: 'Asia/Seoul' })
        );
    });

    it('옵션을 그대로 적용한다', () => {
        expect(
            cachedDateTimeFormat('en-US', {
                timeZone: 'UTC',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date('2026-09-18T23:00:00.000Z'))
        ).toBe('09/18/2026');
    });
});
