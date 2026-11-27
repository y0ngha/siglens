import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailsStepForm } from '@/features/auth-signup/ui/DetailsStepForm';
import { detectBrowserTimeZone } from '@/features/email-report-settings/lib/settingsForm';

vi.mock('@/features/email-report-settings/lib/settingsForm', async () => ({
    ...(await vi.importActual(
        '@/features/email-report-settings/lib/settingsForm'
    )),
    detectBrowserTimeZone: vi.fn(),
}));

const mockDetect = vi.mocked(detectBrowserTimeZone);

function renderForm(): HTMLElement {
    const { container } = render(
        <DetailsStepForm
            step={{
                action: vi.fn(),
                bannerError: undefined,
                passwordError: undefined,
                consentError: undefined,
            }}
            email="a@b.com"
            onEditEmail={vi.fn()}
        />
    );
    return container;
}

function hidden(container: HTMLElement, name: string): string {
    return (
        container.querySelector<HTMLInputElement>(
            `input[type="hidden"][name="${name}"]`
        )?.value ?? 'MISSING'
    );
}

describe('DetailsStepForm 메일 리포트 수신 선택', () => {
    beforeEach(() => {
        mockDetect.mockReset();
        mockDetect.mockReturnValue('Europe/London');
    });

    it('필수 동의 묶음 아래에 선택 항목이 있고 처음에는 선택되어 있지 않다', () => {
        const container = renderForm();
        const optIn = screen.getByRole('checkbox', {
            name: /메일 리포트 받기/,
        });
        const consentGroup = screen.getByRole('group', { name: '동의 항목' });

        expect(optIn).not.toBeChecked();
        expect(optIn).not.toBeRequired();
        expect(optIn).toHaveAttribute('aria-describedby');
        expect(hidden(container, 'email_report_opt_in')).toBe('false');
        expect(
            consentGroup.compareDocumentPosition(optIn) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('"모두 동의"를 눌러도 선택 항목은 켜지지 않는다', async () => {
        const user = userEvent.setup();
        const container = renderForm();

        await user.click(screen.getByLabelText('모두 동의'));

        expect(
            screen.getByLabelText(/개인정보 수집 및 이용 동의/)
        ).toBeChecked();
        expect(screen.getByLabelText(/서비스 이용약관 동의/)).toBeChecked();
        expect(
            screen.getByRole('checkbox', { name: /메일 리포트 받기/ })
        ).not.toBeChecked();
        expect(hidden(container, 'email_report_opt_in')).toBe('false');
    });

    it('체크하면 true와 브라우저 시간대를 숨은 입력으로 싣고, 풀면 false다', async () => {
        const user = userEvent.setup();
        const container = renderForm();
        const optIn = screen.getByRole('checkbox', {
            name: /메일 리포트 받기/,
        });

        await user.click(optIn);
        expect(hidden(container, 'email_report_opt_in')).toBe('true');
        expect(hidden(container, 'email_report_timezone')).toBe(
            'Europe/London'
        );

        await user.click(optIn);
        expect(hidden(container, 'email_report_opt_in')).toBe('false');
    });

    it('Space 키로 켜고 끈다', async () => {
        const user = userEvent.setup();
        renderForm();
        const optIn = screen.getByRole('checkbox', {
            name: /메일 리포트 받기/,
        });

        optIn.focus();
        await user.keyboard(' ');
        expect(optIn).toBeChecked();
        await user.keyboard(' ');
        expect(optIn).not.toBeChecked();
    });
});
