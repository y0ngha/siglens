const actions = vi.hoisted(() => ({
    state: vi.fn(),
    request: vi.fn(),
    confirm: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
}));
vi.mock('@/entities/mail-alert/actions/getMailAlertStateAction', () => ({
    getMailAlertStateAction: actions.state,
}));
vi.mock('@/entities/mail-alert/actions/requestMailAlertCodeAction', () => ({
    requestMailAlertCodeAction: actions.request,
}));
vi.mock('@/entities/mail-alert/actions/confirmMailAlertAction', () => ({
    confirmMailAlertAction: actions.confirm,
}));
vi.mock('@/entities/mail-alert/actions/addMailAlertTopicAction', () => ({
    addMailAlertTopicAction: actions.add,
}));
vi.mock('@/entities/mail-alert/actions/removeMailAlertTopicAction', () => ({
    removeMailAlertTopicAction: actions.remove,
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    EXTREME_ZONE_REENTRY_GAP,
    FEAR_GREED_LABEL_CUTOFFS,
} from '@y0ngha/siglens-core';
import {
    MAIL_ALERT_HONEYPOT_FIELD,
    MAIL_ALERT_MAX_TOPICS,
    MAIL_ALERT_RESEND_COOLDOWN_SECONDS,
    MAIL_ALERT_SEND_HOURS_KST,
} from '@/entities/mail-alert/lib/mailAlertConstants';
import type {
    MailAlertState,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import { MailAlertDialog } from '@/features/mail-alert/ui/MailAlertDialog';
import { createQueryWrapper } from './support';

const SYMBOL: MailAlertTopic = { kind: 'symbol', symbol: 'AAPL' };
const TITLE = 'AAPL에 새 신호가 잡히면 메일로 알려 드려요';

function open(
    state: MailAlertState,
    topic: MailAlertTopic = SYMBOL,
    onClose: () => void = vi.fn()
) {
    actions.state.mockResolvedValue(state);
    return render(
        <MailAlertDialog topic={topic} title={TITLE} onClose={onClose} />,
        { wrapper: createQueryWrapper() }
    );
}

/** 이 액션이 받은 폼 값 — 호출 순서가 아니라 필드 이름으로 읽는다. */
function formValues(mock: ReturnType<typeof vi.fn>): Record<string, string> {
    const data = mock.mock.calls
        .map(call => call[1])
        .find((arg): arg is FormData => arg instanceof FormData);
    return Object.fromEntries(
        [...(data?.entries() ?? [])].map(([key, value]) => [key, String(value)])
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MailAlertDialog 처음 신청 (new)', () => {
    it('열리면 항목 상태를 읽는 동안 불러오는 중을 알린다', async () => {
        actions.state.mockReturnValue(new Promise(() => {}));
        render(
            <MailAlertDialog topic={SYMBOL} title={TITLE} onClose={vi.fn()} />,
            { wrapper: createQueryWrapper() }
        );

        expect(
            await screen.findByText('불러오는 중이에요')
        ).toBeInTheDocument();
        expect(actions.state).toHaveBeenCalledWith(SYMBOL);
    });

    it('제목, 발송 시각 안내(상수에서), 주소 칸, 고지와 방침 링크를 보인다', async () => {
        open({ status: 'new', accountEmail: null });

        expect(
            await screen.findByRole('dialog', { name: TITLE })
        ).toBeInTheDocument();
        const [from, last] = MAIL_ALERT_SEND_HOURS_KST;
        expect(
            screen.getByText(
                new RegExp(`아침 ${from}시에서 ${last + 1}시 사이`)
            )
        ).toBeInTheDocument();
        const email = await screen.findByLabelText('이메일');
        expect(email).toHaveAttribute('type', 'email');
        expect(email).toHaveAttribute('inputmode', 'email');
        expect(email).toHaveAttribute('autocomplete', 'email');
        expect(
            screen.getByText(/알림 메일을 보내는 데만 이 주소를 써요/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '개인정보처리방침 보기' })
        ).toHaveAttribute('href', '/privacy');
        // 별도 동의 체크박스는 없다(고지와 코드 확인으로 갈음한다).
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('봇 함정 입력은 화면 밖에 있고 탭 순서에서 빠진다', async () => {
        open({ status: 'new', accountEmail: null });
        await screen.findByLabelText('이메일');

        const trap = document.querySelector<HTMLInputElement>(
            `input[name="${MAIL_ALERT_HONEYPOT_FIELD}"]`
        );
        expect(trap).not.toBeNull();
        expect(trap?.tabIndex).toBe(-1);
        expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
        // 함정 래퍼는 absolute라, 가장 가까운 위치 기준 조상이 폼이어야 조상 배치에 휘둘리지 않는다.
        expect(trap?.closest('form')?.classList.contains('relative')).toBe(
            true
        );
    });

    it('인증 전 회원의 계정 주소는 채워져 고정된다', async () => {
        open({ status: 'new', accountEmail: 'me@example.com' });

        const email = await screen.findByLabelText('이메일');
        expect(email).toHaveValue('me@example.com');
        expect(email).toHaveAttribute('readonly');
    });

    it('주소 → 코드 → 완료: 코드 칸으로 포커스가 가고 항목 필드가 함께 간다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({
            status: 'subscribed',
            maskedEmail: 'g***@example.com',
        });
        open({ status: 'new', accountEmail: null });

        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );

        const code = await screen.findByLabelText('인증 코드');
        expect(formValues(actions.request)).toMatchObject({
            email: 'guest@example.com',
        });
        expect(
            screen.getByText(
                'guest@example.com로 보낸 6자리 코드를 입력해 주세요'
            )
        ).toBeInTheDocument();
        expect(code).toHaveAttribute('inputmode', 'numeric');
        expect(code).toHaveAttribute('autocomplete', 'one-time-code');
        expect(code).toHaveAttribute('maxlength', '6');
        await waitFor(() => expect(code).toHaveFocus());

        await user.type(code, '482917');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(
            await screen.findByText(
                '신청했어요. 새로 잡힌 소식이 있는 날 아침에 g***@example.com로 보내 드려요.'
            )
        ).toBeInTheDocument();
        expect(formValues(actions.confirm)).toEqual({
            email: 'guest@example.com',
            code: '482917',
            kind: 'symbol',
            symbol: 'AAPL',
        });
        expect(
            screen.getByRole('link', { name: '회원가입 하기' })
        ).toHaveAttribute('href', expect.stringContaining('/signup'));
        expect(
            screen.getByRole('link', { name: '알림 메일 설정' })
        ).toHaveAttribute('href', '/email-report/alerts');
    });

    it.each([
        ['invalid_email', '이메일 주소를 확인해 주세요.'],
        ['rate_limited', '잠시 뒤 다시 시도해 주세요.'],
        ['unavailable', '지금은 신청할 수 없어요. 잠시 뒤 다시 시도해 주세요.'],
    ])(
        '코드 요청이 %s이면 주소 단계에 문구를 알리고 포커스를 옮긴다',
        async (status, text) => {
            const user = userEvent.setup();
            actions.request.mockResolvedValue({ status });
            open({ status: 'new', accountEmail: null });

            const email = await screen.findByLabelText('이메일');
            await user.type(email, 'guest@example.com');
            await user.click(
                screen.getByRole('button', { name: '인증 코드 받기' })
            );

            expect(await screen.findByText(text)).toBeInTheDocument();
            await waitFor(() => expect(email).toHaveFocus());
            expect(email).toHaveAttribute('aria-invalid', 'true');
        }
    );

    it.each([
        ['wrong_code', '인증 코드가 맞지 않아요.'],
        ['expired', '코드가 만료됐어요. 다시 받아 주세요.'],
        ['too_many', '여러 번 틀려서 코드를 다시 받아야 해요.'],
        [
            'limit_reached',
            `받을 항목은 ${MAIL_ALERT_MAX_TOPICS}개까지예요. 알림 메일 설정에서 정리해 주세요.`,
        ],
        [
            'invalid',
            '요청을 처리하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.',
        ],
    ])('코드 확인이 %s이면 코드 단계에 문구를 알린다', async (status, text) => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({ status });
        open({ status: 'new', accountEmail: null });

        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await user.type(await screen.findByLabelText('인증 코드'), '111111');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(await screen.findByText(text)).toBeInTheDocument();
    });

    it('이메일 바꾸기는 주소 단계로 돌아가 쓴 주소를 남겨 둔다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        open({ status: 'new', accountEmail: null });

        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await screen.findByLabelText('인증 코드');
        await user.click(screen.getByRole('button', { name: '이메일 바꾸기' }));

        expect(await screen.findByLabelText('이메일')).toHaveValue(
            'guest@example.com'
        );
    });
});

describe('MailAlertDialog 코드 다시 받기 쿨다운', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('코드를 보낸 뒤 60초 동안 잠기고(aria-disabled) 지나면 풀린다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        open({ status: 'new', accountEmail: null });

        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        const resend = await screen.findByRole('button', {
            name: new RegExp(
                `코드 다시 받기 \\(${MAIL_ALERT_RESEND_COOLDOWN_SECONDS}초\\)`
            ),
        });
        expect(resend).toHaveAttribute('aria-disabled', 'true');
        const callsBefore = actions.request.mock.calls.length;
        await user.click(resend);
        expect(actions.request).toHaveBeenCalledTimes(callsBefore);

        await act(async () => {
            vi.advanceTimersByTime(MAIL_ALERT_RESEND_COOLDOWN_SECONDS * 1000);
        });

        const ready = await screen.findByRole('button', {
            name: '코드 다시 받기',
        });
        expect(ready).toHaveAttribute('aria-disabled', 'false');
        await user.click(ready);
        await waitFor(() =>
            expect(actions.request.mock.calls.length).toBe(callsBefore + 1)
        );
    });
});

describe('MailAlertDialog 다시 받기 실패', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('다시 받기가 한도에 걸려도 코드 단계에 머물고 그 자리에서 알린다', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        actions.request.mockResolvedValueOnce({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        open({ status: 'new', accountEmail: null });
        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await screen.findByLabelText('인증 코드');
        await act(async () => {
            vi.advanceTimersByTime(MAIL_ALERT_RESEND_COOLDOWN_SECONDS * 1000);
        });

        actions.request.mockResolvedValueOnce({ status: 'rate_limited' });
        await user.click(
            await screen.findByRole('button', { name: '코드 다시 받기' })
        );

        expect(
            await screen.findByText('잠시 뒤 다시 시도해 주세요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
        expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    });
});

describe('MailAlertDialog 코드 없이 받는 경우', () => {
    it('회원: 가린 주소와 보유·관심종목 체크박스를 보이고, 고른 값으로 받는다', async () => {
        const user = userEvent.setup();
        actions.add.mockResolvedValue({
            status: 'subscribed',
            maskedEmail: 'm***@example.com',
        });
        open({
            status: 'member',
            maskedEmail: 'm***@example.com',
            includePortfolio: false,
        });

        expect(
            await screen.findByText('m***@example.com로 보내 드려요.')
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole('checkbox', {
                name: '담아 둔 보유 종목과 관심종목의 새 신호도 함께 받기',
            })
        );
        await user.click(screen.getByRole('button', { name: '받기' }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            '신청했어요.'
        );
        expect(actions.add).toHaveBeenCalledWith(SYMBOL, true);
        // 회원에게는 가입 제안이 필요 없다.
        expect(
            screen.queryByRole('link', { name: '회원가입 하기' })
        ).toBeNull();
    });

    it('회원: 스위치가 이미 켜져 있으면 체크박스를 보이지 않는다', async () => {
        open({
            status: 'member',
            maskedEmail: 'm***@example.com',
            includePortfolio: true,
        });

        await screen.findByRole('button', { name: '받기' });
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('같은 브라우저: 이 항목만 더하거나 다른 주소로 코드를 받으러 간다', async () => {
        const user = userEvent.setup();
        actions.add.mockResolvedValue({
            status: 'subscribed',
            maskedEmail: 'g***@example.com',
        });
        open({ status: 'known', maskedEmail: 'g***@example.com' });

        expect(
            await screen.findByText('g***@example.com로 받고 있어요.')
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole('button', { name: '이 항목도 받기' })
        );
        expect(await screen.findByRole('status')).toHaveTextContent(
            '신청했어요.'
        );
        expect(actions.add).toHaveBeenCalledWith(SYMBOL, false);
    });

    it('같은 브라우저: 다른 주소로 받기는 주소 입력 폼을 연다', async () => {
        const user = userEvent.setup();
        open({ status: 'known', maskedEmail: 'g***@example.com' });

        await user.click(
            await screen.findByRole('button', { name: '다른 주소로 받기' })
        );

        expect(await screen.findByLabelText('이메일')).toBeInTheDocument();
        expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');
    });

    it.each([
        ['limit_reached', `받을 항목은 ${MAIL_ALERT_MAX_TOPICS}개까지예요`],
        ['rate_limited', '잠시 뒤 다시 시도해 주세요.'],
        ['needs_code', '요청을 처리하지 못했어요'],
        ['unavailable', '지금은 신청할 수 없어요'],
    ])('받기가 %s이면 문구를 알린다', async (status, text) => {
        const user = userEvent.setup();
        actions.add.mockResolvedValue({ status });
        open({ status: 'known', maskedEmail: 'g***@example.com' });

        await user.click(
            await screen.findByRole('button', { name: '이 항목도 받기' })
        );

        expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
    });
});

describe('MailAlertDialog 이미 받는 경우', () => {
    it('이미 받고 있음을 알리고 그만 받기를 누르면 멈췄다고 알린다', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'subscriber_removed' });
        open({ status: 'subscribed', maskedEmail: 'g***@example.com' });

        expect(
            await screen.findByText('이미 받고 있어요.')
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '그만 받기' }));

        expect(
            await screen.findByText('그만 받기로 했어요.')
        ).toBeInTheDocument();
        expect(actions.remove).toHaveBeenCalledWith(SYMBOL);
        expect(screen.queryByRole('button', { name: '그만 받기' })).toBeNull();
    });

    it('그만 받기가 실패하면 문구를 알리고 버튼은 남는다', async () => {
        const user = userEvent.setup();
        actions.remove.mockResolvedValue({ status: 'unavailable' });
        open({ status: 'subscribed', maskedEmail: 'g***@example.com' });

        await user.click(
            await screen.findByRole('button', { name: '그만 받기' })
        );

        expect(
            await screen.findByText(/지금은 신청할 수 없어요/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '그만 받기' })
        ).toBeInTheDocument();
    });
});

describe('MailAlertDialog 그 밖', () => {
    it.each([
        [
            '서버가 unavailable로 답하면',
            () => actions.state.mockResolvedValue({ status: 'unavailable' }),
        ],
        [
            '상태 읽기가 실패하면',
            () => actions.state.mockRejectedValue(new Error('x')),
        ],
    ])('%s 폼 없이 안내만 보인다', async (_name, arrange) => {
        arrange();
        render(
            <MailAlertDialog topic={SYMBOL} title={TITLE} onClose={vi.fn()} />,
            { wrapper: createQueryWrapper() }
        );

        expect(await screen.findByRole('alert')).toHaveTextContent(
            '지금은 신청할 수 없어요'
        );
        expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    });

    it('공포 탐욕 화면이면 점수 기준과 재진입 간격을 상수에서 안내한다', async () => {
        open(
            { status: 'new', accountEmail: null },
            { kind: 'fear_greed', market: 'us' }
        );

        const rule = await screen.findByText(/극단적 공포에 들어서거나/);
        expect(rule).toHaveTextContent(
            `${FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX}점 아래`
        );
        expect(rule).toHaveTextContent(
            `${FEAR_GREED_LABEL_CUTOFFS.GREED_MAX}점 이상`
        );
        expect(rule).toHaveTextContent(
            `${EXTREME_ZONE_REENTRY_GAP}거래일 안에`
        );
    });

    it('종목 화면에는 공포 탐욕 규칙 문장이 없다', async () => {
        open({ status: 'new', accountEmail: null });

        await screen.findByLabelText('이메일');
        expect(screen.queryByText(/극단적 공포에 들어서거나/)).toBeNull();
    });

    it('닫기 버튼과 Esc가 닫는다', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        open({ status: 'new', accountEmail: null }, SYMBOL, onClose);

        await user.click(await screen.findByRole('button', { name: '닫기' }));
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
