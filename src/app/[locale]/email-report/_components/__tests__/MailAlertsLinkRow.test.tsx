const launched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: () => launched.value,
    })
);

import { render, screen } from '@testing-library/react';
import { MailAlertsLinkRow } from '@/app/[locale]/email-report/_components/MailAlertsLinkRow';

describe('MailAlertsLinkRow', () => {
    it('공개 전에는 그리지 않는다', () => {
        launched.value = false;
        const { container } = render(<MailAlertsLinkRow />);

        expect(container).toBeEmptyDOMElement();
    });

    it('공개 후에는 알림 메일 설정으로 가는 링크 행을 그린다', () => {
        launched.value = true;
        render(<MailAlertsLinkRow />);

        const link = screen.getByRole('link', { name: /알림 메일 설정/ });
        expect(link).toHaveAttribute('href', '/email-report/alerts');
        expect(link).toHaveTextContent('새 신호와 공포 탐욕 지수 알림');
    });
});
