import { render } from '@testing-library/react';
import { MenuTriggerText } from '../../ui/MenuTriggerText';

describe('MenuTriggerText', () => {
    it('개수가 없으면 이름과 ▾만 그린다', () => {
        const { container } = render(
            <MenuTriggerText base="보조지표" withCount={null} />
        );
        expect(container.textContent).toBe('보조지표▾');
    });

    it('개수가 있으면 모바일용 짧은 이름(sm:hidden)과 sm 이상용 개수 이름(max-sm:hidden)을 함께 두고 모두 장식으로 둔다', () => {
        const { container } = render(
            <MenuTriggerText base="차트 작도" withCount="차트 작도 (3)" />
        );
        const short = container.querySelector('.sm\\:hidden');
        const long = container.querySelector('.max-sm\\:hidden');
        expect(short).toHaveTextContent('차트 작도');
        expect(long).toHaveTextContent('차트 작도 (3)');
        for (const el of container.querySelectorAll('span'))
            expect(el).toHaveAttribute('aria-hidden', 'true');
    });
});
