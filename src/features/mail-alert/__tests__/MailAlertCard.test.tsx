/**
 * 지연 로드되는 대화상자는 여기서 가짜로 바꾼다 — `next/dynamic`이 첫 렌더 때 모듈을 내려받는 시간에 따라
 * 테스트가 갈리지(느린 CI에서 `findByRole` 타임아웃) 않게 한다. 대화상자 자체는 `MailAlertDialog.test.tsx`가 본다.
 */
vi.mock('@/features/mail-alert/ui/MailAlertDialog', () => ({
    MailAlertDialog: ({
        title,
        onClose,
    }: {
        title: string;
        onClose: () => void;
    }) => (
        <div role="dialog" aria-label={title}>
            <button type="button" onClick={onClose}>
                닫기
            </button>
        </div>
    ),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { MailAlertCard } from '@/features/mail-alert/ui/MailAlertCard';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';

const FEAR_GREED = {
    kind: 'fear_greed',
    market: 'kr',
    marketLabel: '한국',
} as const;
const HUB = {
    kind: 'signal',
    signalType: 'golden_cross',
    hubName: '골든크로스',
} as const;

describe('MailAlertCard', () => {
    it('공포 탐욕 화면: 한 줄 문구와 버튼', () => {
        render(<MailAlertCard target={FEAR_GREED} />);

        expect(
            screen.getByText(
                '극단적 공포나 극단적 탐욕에 들어선 날 아침에 메일로 알려 드려요'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '메일로 받기' })
        ).toBeInTheDocument();
    });

    it('신호별 종목 화면: 신호 이름이 든 문구', () => {
        render(<MailAlertCard target={HUB} />);

        expect(
            screen.getByText(
                '새로 잡힌 골든크로스 종목을 아침에 메일로 받아 보세요'
            )
        ).toBeInTheDocument();
    });

    it('서버 렌더에는 문구와 버튼 글자가 있고 링크는 없다(버튼은 대화상자를 여는 <button>)', () => {
        const html = renderToString(
            withLocale(<MailAlertCard target={FEAR_GREED} />, 'ko')
        );

        expect(html).toContain('극단적 공포나 극단적 탐욕에 들어선 날');
        expect(html).toContain('메일로 받기');
        expect(html).not.toContain('<a ');
        expect(html).not.toContain('role="dialog"');
    });

    it('버튼을 누르면 시장 이름이 든 제목으로 대화상자가 열린다', async () => {
        const user = userEvent.setup();
        render(<MailAlertCard target={FEAR_GREED} />);

        await user.click(screen.getByRole('button', { name: '메일로 받기' }));

        expect(
            await screen.findByRole('dialog', {
                name: '한국 공포 탐욕 지수가 극단 구간에 들어서면 메일로 알려 드려요',
            })
        ).toBeInTheDocument();
    });

    it('신호 화면의 대화상자 제목은 신호 이름이다', async () => {
        const user = userEvent.setup();
        render(<MailAlertCard target={HUB} />);

        await user.click(screen.getByRole('button', { name: '메일로 받기' }));

        expect(
            await screen.findByRole('dialog', {
                name: '새로 잡힌 골든크로스 종목을 메일로 알려 드려요',
            })
        ).toBeInTheDocument();
    });
});
