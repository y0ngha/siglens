import { render, screen } from '@testing-library/react';
import {
    AiPillLink,
    AiTextLink,
    AiWordmarkLink,
} from '../../../ui/ai/AiLinkVariants';

const base = {
    href: 'https://ai.example.com/',
    brandLabel: '시그렌즈 AI',
};

describe('AI 진입 링크 변형', () => {
    it('text는 보이는 글자가 이름이고 aria-label이 없다', () => {
        render(<AiTextLink {...base} onAiHost={false} className="x" />);

        const link = screen.getByRole('link', { name: '시그렌즈 AI' });
        expect(link).not.toHaveAttribute('aria-label');
        expect(link).toHaveClass('x');
    });

    it('wordmark는 이름이 "SIGLENS AI Beta"이고 보이는 "AI"를 포함한다', () => {
        render(<AiWordmarkLink {...base} onAiHost={false} />);

        const link = screen.getByRole('link', { name: 'SIGLENS AI Beta' });
        expect(link.textContent).toContain('AI');
    });

    it('pill의 이름은 보이는 제품명과 Beta를 포함한다', () => {
        render(<AiPillLink {...base} onAiHost={false} />);

        const link = screen.getByRole('link', { name: '시그렌즈 AI Beta' });
        expect(link.textContent).toContain('시그렌즈 AI');
    });

    it.each([
        ['text', AiTextLink],
        ['wordmark', AiWordmarkLink],
        ['pill', AiPillLink],
    ])('%s는 ai 호스트에서만 aria-current="page"', (_name, Variant) => {
        const { rerender } = render(<Variant {...base} onAiHost />);
        expect(screen.getByRole('link')).toHaveAttribute(
            'aria-current',
            'page'
        );

        rerender(<Variant {...base} onAiHost={false} />);
        expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
    });
});
