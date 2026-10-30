import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import type { Locale } from '@/shared/i18n/locales';

import { ConfidenceInfo } from '../../../ui/skills-showcase/ConfidenceInfo';

/**
 * 등급 문장은 경계(50/80)를 ICU 인자로 받는 단일 메시지다. 색 로직이 `>= 0.5`를 보통으로
 * 치므로 모든 로케일이 "미만/이상" 기준으로 같은 구간을 말해야 한다("이하"는 어긋난다).
 */
const TIER_SENTENCE: Record<Locale, string> = {
    ko: '50% 미만은 낮음, 50% 이상 80% 미만은 보통, 80% 이상은 높음이에요.',
    en: 'Below 50% is low, 50% to under 80% is normal, and 80% or more is high.',
    ja: '50%未満は低め、50%以上80%未満は普通、80%以上は高めです。',
    zh: '低于 50% 为低，50% 以上、低于 80% 为中等，80% 及以上为高。',
};

function openTooltip(locale: Locale): void {
    renderWithIntl(<ConfidenceInfo />, { locale });
    fireEvent.click(screen.getByRole('button'));
}

describe('ConfidenceInfo', () => {
    it.each(Object.entries(TIER_SENTENCE) as [Locale, string][])(
        '%s: 경계 문장이 색 로직과 같은 기준(미만/이상)으로 한 문장에 나온다',
        (locale, sentence) => {
            openTooltip(locale);

            expect(screen.getByRole('tooltip')).toHaveTextContent(sentence);
        }
    );

    it('트리거 버튼 이름이 무엇을 설명하는지 말한다(범용 "추가 정보"가 아니다)', () => {
        renderWithIntl(<ConfidenceInfo />, { locale: 'ko' });
        expect(
            screen.getByRole('button', { name: '신뢰도 점수 설명' })
        ).toBeInTheDocument();
    });

    it('en에 "or less" 문구가 남지 않는다', () => {
        openTooltip('en');
        expect(screen.getByRole('tooltip')).not.toHaveTextContent(/or less/);
    });

    it('zh에 "以下为低"가 남지 않는다', () => {
        openTooltip('zh');
        expect(screen.getByRole('tooltip')).not.toHaveTextContent(/以下为低/);
    });

    it('열기 전에는 툴팁 본문이 DOM에 없다', () => {
        renderWithIntl(<ConfidenceInfo />);

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('키보드(Tab → Enter)로 열고 Escape로 닫는다', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ConfidenceInfo />);

        await user.tab();
        expect(screen.getByRole('button')).toHaveFocus();

        await user.keyboard('{Enter}');
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('버튼을 누를 때마다 열림/닫힘이 토글된다', () => {
        renderWithIntl(<ConfidenceInfo />);
        const button = screen.getByRole('button');

        fireEvent.click(button);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.click(button);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
});
