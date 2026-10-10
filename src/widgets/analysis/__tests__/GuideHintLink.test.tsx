import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import ko from '../../../../messages/ko.json';
import en from '../../../../messages/en.json';
import { GuideHintLink } from '../GuideHintLink';

describe('GuideHintLink', () => {
    it('가이드 경로로 가는 링크이고 접근성 이름에 항목 이름과 보이는 문구가 실린다', () => {
        renderWithIntl(
            <GuideHintLink href="/guide/candlesticks/doji" name="도지" />
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/guide/candlesticks/doji');
        expect(link).toHaveAttribute(
            'aria-label',
            ko.widgets.analysis.GuideHintLink.aria.replace('{name}', '도지')
        );
        expect(link).toHaveTextContent(ko.widgets.analysis.GuideHintLink.label);
        expect(link.getAttribute('aria-label')).toContain(
            ko.widgets.analysis.GuideHintLink.label
        );
    });

    it('같은 문구 링크라도 name마다 접근성 이름이 다르다', () => {
        renderWithIntl(
            <>
                <GuideHintLink href="/guide/a" name="알파" />
                <GuideHintLink href="/guide/b" name="베타" />
            </>
        );

        expect(
            screen.getAllByRole('link').map(l => l.getAttribute('aria-label'))
        ).toEqual([
            ko.widgets.analysis.GuideHintLink.aria.replace('{name}', '알파'),
            ko.widgets.analysis.GuideHintLink.aria.replace('{name}', '베타'),
        ]);
    });

    it('en 로케일은 영어 문구와 /en 접두사 href를 쓴다', () => {
        renderWithIntl(
            <GuideHintLink href="/guide/indicators/rsi" name="RSI" />,
            {
                locale: 'en',
            }
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/en/guide/indicators/rsi');
        expect(link).toHaveTextContent(en.widgets.analysis.GuideHintLink.label);
    });
});
