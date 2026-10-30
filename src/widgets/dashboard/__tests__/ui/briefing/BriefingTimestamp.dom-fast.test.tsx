import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { BriefingTimestamp } from '@/widgets/dashboard/ui/briefing/BriefingTimestamp';

const GENERATED_AT = '2025-01-15T10:00:00Z';

describe('BriefingTimestamp', () => {
    it('유효한 시각이면 <time>에 ISO 값과 날짜·시각만 담는다', () => {
        const { container } = renderWithIntl(
            <BriefingTimestamp generatedAt={GENERATED_AT} />
        );
        const time = container.querySelector('time');
        expect(time).toHaveAttribute('dateTime', '2025-01-15T10:00:00.000Z');
        expect(time?.textContent).toContain('07:00');
        expect(time?.textContent).not.toMatch(/GMT|KST/);
    });

    it.each([
        ['ko', /^1월 15일.*KST 기준$/],
        ['en', /^As of January 15.* KST$/],
        ['ja', /^1月15日.*KST基準$/],
        ['zh', /^截至 1月15日.*（KST）$/],
    ] as const)(
        '%s: 문장이 어순에 맞게 KST 표기를 포함한다',
        (locale, pattern) => {
            const { container } = renderWithIntl(
                <BriefingTimestamp generatedAt={GENERATED_AT} />,
                { locale }
            );
            expect(container.querySelector('p')?.textContent).toMatch(pattern);
        }
    );

    it.each(['', 'not-a-date'])(
        '시각이 %j이면 보이지 않는 한 줄 자리만 남긴다',
        generatedAt => {
            const { container } = renderWithIntl(
                <BriefingTimestamp generatedAt={generatedAt} />
            );
            const placeholder = container.querySelector('p.invisible');
            expect(placeholder).toHaveAttribute('aria-hidden', 'true');
            expect(container.querySelector('time')).toBeNull();
        }
    );
});
