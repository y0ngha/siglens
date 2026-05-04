/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentCheckboxGroup } from '@/components/auth/ConsentCheckboxGroup';

describe('ConsentCheckboxGroup', () => {
    function Renderer({
        initialPrivacy = false,
        initialTos = false,
        error,
    }: {
        initialPrivacy?: boolean;
        initialTos?: boolean;
        error?: string;
    } = {}) {
        const [p, setP] = require('react').useState(initialPrivacy);
        const [t, setT] = require('react').useState(initialTos);
        return (
            <ConsentCheckboxGroup
                privacyChecked={p}
                tosChecked={t}
                onPrivacyChange={setP}
                onTosChange={setT}
                error={error}
            />
        );
    }

    it('renders fieldset with sr-only legend', () => {
        render(<Renderer />);
        expect(screen.getByText('동의 항목')).toHaveClass('sr-only');
    });

    it('renders three checkboxes (master + privacy + tos)', () => {
        render(<Renderer />);
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
    });

    it('checking master toggles both individual checkboxes', async () => {
        const user = userEvent.setup();
        render(<Renderer />);
        const master = screen.getByLabelText('모두 동의');
        await user.click(master);
        expect(screen.getByLabelText(/개인정보 수집·이용 동의/)).toBeChecked();
        expect(screen.getByLabelText(/서비스 이용약관 동의/)).toBeChecked();
    });

    it('unchecking master clears both individuals', async () => {
        const user = userEvent.setup();
        render(<Renderer initialPrivacy initialTos />);
        const master = screen.getByLabelText('모두 동의');
        await user.click(master);
        expect(screen.getByLabelText(/개인정보 수집·이용 동의/)).not.toBeChecked();
        expect(screen.getByLabelText(/서비스 이용약관 동의/)).not.toBeChecked();
    });

    it('individual checkbox toggle does not affect the other', async () => {
        const user = userEvent.setup();
        render(<Renderer />);
        await user.click(screen.getByLabelText(/개인정보 수집·이용 동의/));
        expect(screen.getByLabelText(/개인정보 수집·이용 동의/)).toBeChecked();
        expect(screen.getByLabelText(/서비스 이용약관 동의/)).not.toBeChecked();
    });

    it('master shows checked when both individuals checked', () => {
        render(<Renderer initialPrivacy initialTos />);
        expect(screen.getByLabelText('모두 동의')).toBeChecked();
    });

    it('master shows indeterminate when only one individual checked', () => {
        render(<Renderer initialPrivacy initialTos={false} />);
        const master = screen.getByLabelText('모두 동의') as HTMLInputElement;
        expect(master.indeterminate).toBe(true);
        expect(master.checked).toBe(false);
    });

    it('renders error message with role=alert and aria-live=polite', () => {
        render(<Renderer error="개인정보처리방침과 이용약관에 동의해주세요." />);
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('개인정보처리방침과 이용약관에 동의해주세요.');
        expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('individual checkboxes are required and aria-required', () => {
        render(<Renderer />);
        const privacy = screen.getByLabelText(/개인정보 수집·이용 동의/) as HTMLInputElement;
        expect(privacy).toBeRequired();
        expect(privacy).toHaveAttribute('aria-required', 'true');
    });

    it('detail links open in new tab with rel=noopener and aria-label', () => {
        render(<Renderer />);
        const privacyLink = screen.getByLabelText('개인정보처리방침 자세히 보기');
        expect(privacyLink).toHaveAttribute('target', '_blank');
        expect(privacyLink.getAttribute('rel')).toContain('noopener');
    });

    it('error highlights only the unchecked rows (border-ui-danger)', () => {
        render(<Renderer initialPrivacy={false} initialTos error="에러" />);
        const privacyRow = screen.getByLabelText(/개인정보 수집·이용 동의/).closest('label');
        expect(privacyRow?.className).toContain('border-ui-danger');
    });
});
