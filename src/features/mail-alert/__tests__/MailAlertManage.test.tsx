const actions = vi.hoisted(() => ({
    remove: vi.fn(),
    unsubscribe: vi.fn(),
    portfolio: vi.fn(),
}));
vi.mock('@/entities/mail-alert/actions/removeMailAlertTopicAction', () => ({
    removeMailAlertTopicAction: actions.remove,
}));
vi.mock('@/entities/mail-alert/actions/unsubscribeMailAlertAction', () => ({
    unsubscribeMailAlertAction: actions.unsubscribe,
}));
vi.mock(
    '@/entities/mail-alert/actions/setMailAlertIncludePortfolioAction',
    () => ({
        setMailAlertIncludePortfolioAction: actions.portfolio,
    })
);

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { MailAlertManage } from '@/features/mail-alert/ui/MailAlertManage';
import { createQueryWrapper } from './support';

const AAPL: MailAlertTopic = { kind: 'symbol', symbol: 'AAPL' };
const HUB: MailAlertTopic = { kind: 'signal', signalType: 'golden_cross' };
const LINK = { s: 'sub-1', sig: 'abc' };

const TOPICS = [
    { topic: AAPL, label: 'AAPL 새 신호' },
    { topic: HUB, label: '새로 잡힌 골든크로스 종목' },
];

function show(
    overrides: Partial<React.ComponentProps<typeof MailAlertManage>> = {}
) {
    return render(
        <MailAlertManage
            maskedEmail="g***@example.com"
            topics={TOPICS}
            includePortfolio={null}
            {...overrides}
        />,
        { wrapper: createQueryWrapper() }
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MailAlertManage', () => {
    it('받는 주소와 항목을 한 줄씩 보인다(회원 아니면 스위치가 없다)', () => {
        show();

        expect(
            screen.getByText('g***@example.com로 받고 있어요.')
        ).toBeInTheDocument();
        const rows = screen.getAllByRole('listitem');
        expect(rows).toHaveLength(2);
        expect(
            within(rows[0] as HTMLElement).getByText('AAPL 새 신호')
        ).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('항목의 그만 받기는 라벨이 든 이름이고, 누르면 그 항목만 빠진다(링크 값을 그대로 보낸다)', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'ok' });
        show({ link: LINK });

        await user.click(
            screen.getByRole('button', { name: 'AAPL 새 신호 그만 받기' })
        );

        expect(actions.remove).toHaveBeenCalledWith(AAPL, LINK);
        await screen.findByText('새로 잡힌 골든크로스 종목');
        expect(screen.queryByText('AAPL 새 신호')).not.toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('이미 없는 항목(not_found)도 화면에서는 빼고 오류로 알리지 않는다', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'not_found' });
        show();

        await user.click(
            screen.getByRole('button', { name: 'AAPL 새 신호 그만 받기' })
        );

        await screen.findByText('새로 잡힌 골든크로스 종목');
        expect(screen.queryByText('AAPL 새 신호')).not.toBeInTheDocument();
        expect(screen.queryByText(/요청을 처리하지 못했어요/)).toBeNull();
    });

    it('제거가 실패하면 문구를 알리고 항목은 남는다', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'unavailable' });
        show();

        await user.click(
            screen.getByRole('button', { name: 'AAPL 새 신호 그만 받기' })
        );

        expect(
            await screen.findByText(/지금은 신청할 수 없어요/)
        ).toBeInTheDocument();
        expect(screen.getByText('AAPL 새 신호')).toBeInTheDocument();
    });

    it('마지막 항목을 지우면 구독자도 지워졌다는 완료 문구만 남는다', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'subscriber_removed' });
        show({ topics: [TOPICS[0] as (typeof TOPICS)[number]] });

        await user.click(
            screen.getByRole('button', { name: 'AAPL 새 신호 그만 받기' })
        );

        expect(
            await screen.findByText(
                '알림 메일을 모두 그만 받아요. 신청 정보와 발송 기록을 지웠어요.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('항목이 하나도 없으면 안내만 보인다', () => {
        show({ topics: [] });

        expect(
            screen.getByText('받고 있는 항목이 없어요.')
        ).toBeInTheDocument();
    });

    it('회원: 보유·관심종목 스위치가 현재 값으로 보이고 바꾸면 서버에 보낸다', async () => {
        const user = userEvent.setup();
        actions.portfolio.mockResolvedValue({ status: 'ok' });
        show({ includePortfolio: false });

        const toggle = screen.getByRole('checkbox', {
            name: '담아 둔 보유 종목과 관심종목의 새 신호도 함께 받기',
        });
        expect(toggle).not.toBeChecked();
        await user.click(toggle);

        expect(actions.portfolio).toHaveBeenCalledWith(true);
        expect(toggle).toBeChecked();
    });

    it('스위치를 끄면서 받을 것이 없어져 구독자가 지워지면 완료 문구다', async () => {
        const user = userEvent.setup();
        actions.portfolio.mockResolvedValue({ status: 'subscriber_removed' });
        show({ topics: [], includePortfolio: true });

        await user.click(screen.getByRole('checkbox'));

        expect(
            await screen.findByText(/알림 메일을 모두 그만 받아요/)
        ).toBeInTheDocument();
    });

    it('스위치 변경이 실패하면 값은 그대로이고 문구를 알린다', async () => {
        const user = userEvent.setup();
        actions.portfolio.mockResolvedValue({ status: 'unavailable' });
        show({ includePortfolio: true });

        await user.click(screen.getByRole('checkbox'));

        expect(
            await screen.findByText(/지금은 신청할 수 없어요/)
        ).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('모두 그만 받기는 한 번 더 묻고, 취소하면 아무것도 보내지 않는다', async () => {
        const user = userEvent.setup();
        show();

        const section = screen.getByRole('region', {
            name: '알림 메일 모두 그만 받기',
        });
        await user.click(
            within(section).getByRole('button', {
                name: '알림 메일 모두 그만 받기',
            })
        );
        expect(
            screen.getByText(
                '정말 모두 그만 받을까요? 신청 정보와 발송 기록을 바로 지워요.'
            )
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '취소' }));

        expect(actions.unsubscribe).not.toHaveBeenCalled();
        expect(
            screen.getByRole('button', { name: '알림 메일 모두 그만 받기' })
        ).toBeInTheDocument();
    });

    it('확인하면 전체 해지를 보내고(링크 값 포함) 완료 문구를 보인다', async () => {
        const user = userEvent.setup();
        actions.unsubscribe.mockResolvedValue({ status: 'subscriber_removed' });
        show({ link: LINK });

        await user.click(
            screen.getByRole('button', { name: '알림 메일 모두 그만 받기' })
        );
        await user.click(
            screen.getByRole('button', { name: '네, 모두 그만 받기' })
        );

        expect(actions.unsubscribe).toHaveBeenCalledWith(LINK);
        expect(
            await screen.findByText(/알림 메일을 모두 그만 받아요/)
        ).toBeInTheDocument();
    });

    it('전체 해지가 실패하면 문구를 알리고 목록은 남는다', async () => {
        const user = userEvent.setup();
        actions.unsubscribe.mockResolvedValue({ status: 'unavailable' });
        show();

        await user.click(
            screen.getByRole('button', { name: '알림 메일 모두 그만 받기' })
        );
        await user.click(
            screen.getByRole('button', { name: '네, 모두 그만 받기' })
        );

        expect(
            await screen.findByText(/지금은 신청할 수 없어요/)
        ).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('해지 구역은 메일 속 #unsubscribe 링크가 가리키는 id를 가진다', () => {
        show();

        expect(
            screen.getByRole('region', { name: '알림 메일 모두 그만 받기' })
        ).toHaveAttribute('id', 'unsubscribe');
    });
});
