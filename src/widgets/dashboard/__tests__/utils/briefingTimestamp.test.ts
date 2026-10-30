import {
    formatBriefingTime,
    parseGeneratedAt,
} from '@/widgets/dashboard/utils/briefingTimestamp';

const INSTANT = new Date('2025-01-15T10:00:00Z');

describe('parseGeneratedAt', () => {
    it('ISO 문자열을 날짜로 읽는다', () => {
        expect(parseGeneratedAt('2025-01-15T10:00:00Z')?.toISOString()).toBe(
            '2025-01-15T10:00:00.000Z'
        );
    });

    it('빈 문자열(peek seed)은 null이다', () => {
        expect(parseGeneratedAt('')).toBeNull();
    });

    it('읽을 수 없는 문자열은 null이다', () => {
        expect(parseGeneratedAt('not-a-date')).toBeNull();
    });
});

describe('formatBriefingTime', () => {
    it.each([
        ['ko', '1월', '07:00'],
        ['en', 'January', '07:00'],
        ['ja', '1月', '19:00'],
        ['zh', '1月', '19:00'],
    ] as const)(
        '%s: 한국 시각(19시)을 그 로케일의 월 표기로 찍는다',
        (locale, month, clock) => {
            const text = formatBriefingTime(INSTANT, locale);
            expect(text).toContain(month);
            expect(text).toContain('15');
            expect(text).toContain(clock);
        }
    );

    it('시간대 이름은 붙이지 않는다 — 문구가 KST를 밝힌다', () => {
        expect(formatBriefingTime(INSTANT, 'en')).not.toMatch(/GMT|KST/);
    });

    describe('실행 환경의 시간대', () => {
        const originalTz = process.env.TZ;

        afterEach(() => {
            if (originalTz === undefined) delete process.env.TZ;
            else process.env.TZ = originalTz;
            vi.resetModules();
        });

        async function formatUnder(tz: string): Promise<string> {
            process.env.TZ = tz;
            vi.resetModules();
            const mod =
                await import('@/widgets/dashboard/utils/briefingTimestamp');
            return mod.formatBriefingTime(INSTANT, 'en');
        }

        it('서로 다른 TZ에서 새로 불러와도 같은 문자열을 만든다', async () => {
            const losAngeles = await formatUnder('America/Los_Angeles');
            const tokyo = await formatUnder('Asia/Tokyo');
            expect(tokyo).toBe(losAngeles);
        });
    });
});
