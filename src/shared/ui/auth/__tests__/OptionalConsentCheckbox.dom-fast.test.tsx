import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { OptionalConsentCheckbox } from '@/shared/ui/auth/OptionalConsentCheckbox';

function Harness({ onChange }: { onChange?: (checked: boolean) => void }) {
    const [checked, setChecked] = useState(false);
    return (
        <OptionalConsentCheckbox
            legend="선택 항목"
            label="소식 받기"
            description="매주 보내 드려요."
            checked={checked}
            onChange={next => {
                setChecked(next);
                onChange?.(next);
            }}
        />
    );
}

describe('OptionalConsentCheckbox', () => {
    it('처음에는 선택되어 있지 않고 필수가 아니다', () => {
        render(<Harness />);
        const box = screen.getByRole('checkbox', { name: /소식 받기/ });

        expect(box).not.toBeChecked();
        expect(box).not.toBeRequired();
        expect(box).not.toHaveAttribute('aria-required');
    });

    it('"(선택)" 표시와 보이지 않는 묶음 이름을 둔다', () => {
        render(<Harness />);

        expect(screen.getByText('(선택)')).toBeInTheDocument();
        expect(screen.getByText('선택 항목')).toHaveClass('sr-only');
        expect(
            screen.getByRole('group', { name: '선택 항목' })
        ).toBeInTheDocument();
    });

    it('설명이 체크박스에 aria-describedby로 연결된다', () => {
        render(<Harness />);
        const box = screen.getByRole('checkbox');
        const describedBy = box.getAttribute('aria-describedby');

        expect(describedBy).not.toBeNull();
        expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
            '매주 보내 드려요.'
        );
    });

    it('클릭과 Space 키로 켜고 끈다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        const box = screen.getByRole('checkbox');

        await user.click(box);
        expect(box).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(true);

        box.focus();
        await user.keyboard(' ');
        expect(box).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it('긴 문장이 좁은 열을 넘기지 않도록 fieldset에 min-w-0을 둔다', () => {
        render(<Harness />);

        expect(screen.getByRole('group')).toHaveClass('min-w-0');
    });

    it('id를 넘기면 그 id를 쓰고 설명 id도 그에서 파생된다', () => {
        render(
            <OptionalConsentCheckbox
                id="opt-in"
                legend="l"
                label="x"
                description="d"
                checked={false}
                onChange={() => {}}
            />
        );
        const box = screen.getByRole('checkbox');

        expect(box).toHaveAttribute('id', 'opt-in');
        expect(box).toHaveAttribute('aria-describedby', 'opt-in-description');
    });
});
