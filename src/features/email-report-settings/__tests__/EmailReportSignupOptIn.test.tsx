import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailReportSignupOptIn } from '@/features/email-report-settings/ui/EmailReportSignupOptIn';
import { detectBrowserTimeZone } from '@/features/email-report-settings/lib/settingsForm';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

vi.mock('@/features/email-report-settings/lib/settingsForm', async () => ({
    ...(await vi.importActual(
        '@/features/email-report-settings/lib/settingsForm'
    )),
    detectBrowserTimeZone: vi.fn(),
}));

const mockDetect = vi.mocked(detectBrowserTimeZone);

function Harness() {
    const [checked, setChecked] = useState(false);
    return <EmailReportSignupOptIn checked={checked} onChange={setChecked} />;
}

function hidden(container: HTMLElement, name: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(
        `input[type="hidden"][name="${name}"]`
    );
    if (input === null) throw new Error(`hidden input not found: ${name}`);
    return input;
}

describe('EmailReportSignupOptIn', () => {
    beforeEach(() => {
        mockDetect.mockReset();
        mockDetect.mockReturnValue('America/New_York');
    });

    it('처음에는 선택되지 않고, 숨은 입력은 false와 빈 시간대다', () => {
        const { container } = renderWithIntl(<Harness />);

        expect(
            screen.getByRole('checkbox', { name: /메일 리포트 받기/ })
        ).not.toBeChecked();
        expect(hidden(container, 'email_report_opt_in').value).toBe('false');
        expect(hidden(container, 'email_report_timezone').value).toBe('');
        expect(mockDetect).not.toHaveBeenCalled();
    });

    it('체크하면 true와 그 순간의 브라우저 시간대를 보낸다', async () => {
        const user = userEvent.setup();
        const { container } = renderWithIntl(<Harness />);

        await user.click(screen.getByRole('checkbox'));

        expect(hidden(container, 'email_report_opt_in').value).toBe('true');
        expect(hidden(container, 'email_report_timezone').value).toBe(
            'America/New_York'
        );
    });

    it('체크를 풀면 false로 돌아간다', async () => {
        const user = userEvent.setup();
        const { container } = renderWithIntl(<Harness />);

        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('checkbox'));

        expect(hidden(container, 'email_report_opt_in').value).toBe('false');
    });

    it('브라우저 시간대를 알 수 없으면 빈 값을 보내 서버가 기본 시간대를 쓰게 한다', async () => {
        mockDetect.mockReturnValue(null);
        const user = userEvent.setup();
        const { container } = renderWithIntl(<Harness />);

        await user.click(screen.getByRole('checkbox'));

        expect(hidden(container, 'email_report_opt_in').value).toBe('true');
        expect(hidden(container, 'email_report_timezone').value).toBe('');
    });

    it('설명은 기본 일정(월요일, 오전 8:00)을 로케일 표기로 적고 체크박스에 연결된다', () => {
        renderWithIntl(<Harness />);
        const box = screen.getByRole('checkbox');
        const description = document.getElementById(
            box.getAttribute('aria-describedby') ?? ''
        );

        expect(description).toHaveTextContent('매주 월요일 오전 8시에');
        expect(description).toHaveTextContent('이 기기의 시간대를 따르고');
    });

    it('일본어·중국어는 방침 문구와 같은 요일·시각 표기를 쓴다', () => {
        const { unmount } = renderWithIntl(<Harness />, { locale: 'ja' });
        const jaBox = screen.getByRole('checkbox');
        expect(
            document.getElementById(
                jaBox.getAttribute('aria-describedby') ?? ''
            )
        ).toHaveTextContent('毎週月曜日の午前8時に');
        unmount();

        renderWithIntl(<Harness />, { locale: 'zh' });
        const zhBox = screen.getByRole('checkbox');
        expect(
            document.getElementById(
                zhBox.getAttribute('aria-describedby') ?? ''
            )
        ).toHaveTextContent('每周一上午8点');
    });

    it('영어 로케일은 영어 요일과 시각으로 적는다', () => {
        renderWithIntl(<Harness />, { locale: 'en' });
        const box = screen.getByRole('checkbox');

        expect(
            document.getElementById(box.getAttribute('aria-describedby') ?? '')
        ).toHaveTextContent('Every Monday at 8 AM');
    });
});
