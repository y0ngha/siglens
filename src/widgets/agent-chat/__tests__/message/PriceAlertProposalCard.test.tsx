const actions = vi.hoisted(() => ({
    state: vi.fn(),
    create: vi.fn(),
    request: vi.fn(),
    confirm: vi.fn(),
}));
vi.mock(
    '@/entities/mail-alert/actions/getPriceAlertProposalStateAction',
    () => ({
        getPriceAlertProposalStateAction: actions.state,
    })
);
vi.mock('@/entities/mail-alert/actions/createPriceAlertAction', () => ({
    createPriceAlertAction: actions.create,
}));
vi.mock('@/entities/mail-alert/actions/requestMailAlertCodeAction', () => ({
    requestMailAlertCodeAction: actions.request,
}));
vi.mock('@/entities/mail-alert/actions/confirmPriceAlertAction', () => ({
    confirmPriceAlertAction: actions.confirm,
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ChatPriceAlertProposalBlock } from '@/entities/chat-conversation/types';
import { MAIL_ALERT_SEND_HOURS_KST } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    PRICE_ALERT_MAX_ACTIVE,
    PRICE_ALERT_TTL_DAYS,
} from '@/entities/mail-alert/lib/priceAlertConstants';
import type { PriceAlertProposal } from '@/entities/mail-alert/model';
import { PriceAlertProposalCard } from '@/widgets/agent-chat/message/PriceAlertProposalCard';
import ko from '../../../../../messages/ko.json';

const SITE = 'https://siglens.io';
const TOKEN = 'body.signature';

function block(
    overrides: Partial<PriceAlertProposal> = {},
    name: string | null = '애플'
): ChatPriceAlertProposalBlock {
    return {
        version: 1,
        kind: 'price_alert_proposal',
        token: TOKEN,
        name,
        proposal: {
            proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
            subject: 'subject-hash',
            symbol: 'AAPL',
            market: 'us',
            condition: { kind: 'close_below', level: 180 },
            basis: 'price_level',
            analysisAt: null,
            referenceClose: 190,
            quoteAt: null,
            startsAfterSession: '2026-11-24',
            expiresOn: '2026-12-24',
            exp: 1_795_000_000,
            ...overrides,
        },
    };
}

function open(
    state: unknown,
    card: ChatPriceAlertProposalBlock = block(),
    localePrefix = ''
) {
    if (state === 'error') {
        actions.state.mockRejectedValue(new Error('network'));
    } else {
        actions.state.mockResolvedValue(state);
    }
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={client}>
            <NextIntlClientProvider
                locale="ko"
                messages={ko}
                timeZone="Asia/Seoul"
            >
                <PriceAlertProposalCard
                    block={card}
                    siteUrl={SITE}
                    localePrefix={localePrefix}
                />
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
}

/** 저장된 알림의 값 — 제안(180 아래, 12-24)과 일부러 다르게 둬서 카드가 어느 쪽을 보이는지 가른다. */
const STORED = {
    condition: { kind: 'close_below', level: 175 },
    expiresOn: '2026-12-28',
} as const;
const MEMBER_READY = {
    status: 'ready',
    mode: 'member',
    maskedEmail: 'm***@example.com',
};
const GUEST_READY = { status: 'ready', mode: 'new', accountEmail: null };

const createButton = () => screen.findByRole('button', { name: '알림 만들기' });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('카드의 문구', () => {
    it('가격 아래: 정확한 가격, 기준, 확인 규칙, 유지 기간을 보인다', async () => {
        open(MEMBER_READY);

        await createButton();
        expect(
            screen.getByRole('heading', { name: '가격대 알림' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '애플 (AAPL) 종가가 $180.00 이하로 내려가면 메일로 알려 드려요.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /이 대화에서 나온 가격이에요\. 2026년 11월 24일 종가 \$190\.00/
            )
        ).toBeInTheDocument();
        const [from, last] = MAIL_ALERT_SEND_HOURS_KST;
        // 마지막 확인 날짜는 만드는 시각에 정해진다 — 만들기 전에는 날짜 대신 기간으로 말한다.
        expect(
            screen.getByText(
                new RegExp(
                    `다음 날 한국 시간 아침 ${from}시에서 ${last + 1}시 사이에 메일로 보내요.*만든 날부터 ${PRICE_ALERT_TTL_DAYS}일 동안 확인해요`
                )
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/2026년 12월 24일 종가까지/)
        ).not.toBeInTheDocument();
    });

    it('가격 위', async () => {
        open(
            MEMBER_READY,
            block({ condition: { kind: 'close_above', level: 200 } })
        );

        expect(
            await screen.findByText(
                '애플 (AAPL) 종가가 $200.00 이상으로 올라가면 메일로 알려 드려요.'
            )
        ).toBeInTheDocument();
    });

    it.each([
        [
            'from_above',
            '애플 (AAPL) 종가가 $178.00~$181.50 구간에 들어오거나 그 아래로 내려가면 메일로 알려 드려요.',
        ],
        [
            'from_below',
            '애플 (AAPL) 종가가 $178.00~$181.50 구간에 들어오거나 그 위로 올라가면 메일로 알려 드려요.',
        ],
    ] as const)(
        '진입 구간(%s)은 닿거나 지나는 쪽을 말한다',
        async (approach, sentence) => {
            open(
                MEMBER_READY,
                block({
                    basis: 'analysis_entry_zone',
                    analysisAt: '2026-11-25T12:00:00.000Z',
                    condition: {
                        kind: 'enter_zone',
                        low: 178,
                        high: 181.5,
                        approach,
                    },
                })
            );

            expect(await screen.findByText(sentence)).toBeInTheDocument();
            expect(
                screen.getByText(/2026년 11월 25일 AI 분석의 진입 구간이에요\./)
            ).toBeInTheDocument();
        }
    );

    it('무효화 기준 알림은 분석 날짜와 함께 기준을 밝힌다', async () => {
        open(
            MEMBER_READY,
            block({
                basis: 'analysis_invalidation',
                analysisAt: '2026-11-25T12:00:00.000Z',
            })
        );

        expect(
            await screen.findByText(
                /2026년 11월 25일 AI 분석의 무효화 기준이에요\./
            )
        ).toBeInTheDocument();
    });

    it('분석 날짜는 시장의 시간대로 읽는다(미국 23:30Z는 뉴욕 같은 날, 한국에서는 다음 날)', async () => {
        const instant = '2026-11-25T23:30:00.000Z';
        open(
            MEMBER_READY,
            block({
                basis: 'analysis_invalidation',
                analysisAt: instant,
                market: 'us',
            })
        );
        expect(
            await screen.findByText(
                /2026년 11월 25일 AI 분석의 무효화 기준이에요\./
            )
        ).toBeInTheDocument();
    });

    it('한국 종목의 분석 날짜는 서울 날짜다(같은 순간이 26일)', async () => {
        open(
            MEMBER_READY,
            block({
                symbol: '005930.KS',
                market: 'kr',
                basis: 'analysis_invalidation',
                analysisAt: '2026-11-25T23:30:00.000Z',
                referenceClose: 70_500,
                condition: { kind: 'close_below', level: 65_000 },
            })
        );
        expect(
            await screen.findByText(
                /2026년 11월 26일 AI 분석의 무효화 기준이에요\./
            )
        ).toBeInTheDocument();
    });

    it('한국 종목은 원화 서식과 단축 코드를 쓴다', async () => {
        open(
            MEMBER_READY,
            block(
                {
                    symbol: '005930.KS',
                    market: 'kr',
                    referenceClose: 70_500,
                    condition: { kind: 'close_below', level: 65_000 },
                },
                '삼성전자'
            )
        );

        expect(
            await screen.findByText(
                '삼성전자 (005930) 종가가 ₩65,000 이하로 내려가면 메일로 알려 드려요.'
            )
        ).toBeInTheDocument();
    });

    it('이름이 없으면 코드만 쓴다', async () => {
        open(MEMBER_READY, block({}, null));

        expect(
            await screen.findByText(/^AAPL 종가가 \$180\.00 이하로/)
        ).toBeInTheDocument();
    });

    it('이름이 코드와 같으면 코드 하나만 쓴다', async () => {
        open(MEMBER_READY, block({}, 'AAPL'));

        expect(
            await screen.findByText(/^AAPL 종가가 \$180\.00 이하로/)
        ).toBeInTheDocument();
    });

    it('한국 종목이 이름 없이 오면 단축 코드만 쓴다', async () => {
        open(MEMBER_READY, block({ symbol: '005930.KS', market: 'kr' }, null));

        expect(await screen.findByText(/^005930 종가가/)).toBeInTheDocument();
    });

    it('투자 조언 문구가 없다(무엇이 울리는지만 말한다)', async () => {
        const { container } = open(MEMBER_READY);
        await createButton();

        expect(container.textContent).not.toMatch(
            /매수|매도|사세요|파세요|손절/
        );
    });
});

describe('만든 뒤에는 저장된 값을 보인다', () => {
    it('제안의 기준 줄과 종가 줄은 사라지고, 저장된 조건과 마지막 확인 날짜가 나온다', async () => {
        open({
            status: 'created',
            maskedEmail: 'm***@example.com',
            owner: 'member',
            stored: STORED,
        });

        expect(
            await screen.findByText(
                '애플 (AAPL) 종가가 $175.00 이하로 내려가면 메일로 알려 드려요.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 12월 28일 종가까지 확인해요/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/\$180\.00/)).not.toBeInTheDocument();
        expect(
            screen.queryByText(/AI 분석의|이 대화에서 나온 가격/)
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/종가 \$190\.00/)).not.toBeInTheDocument();
    });

    it('만들기 결과도 저장된 값으로 바뀐다(구간은 저장된 접근 방향의 문장)', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({
            status: 'created',
            maskedEmail: 'm***@example.com',
            owner: 'member',
            stored: {
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_below',
                },
                expiresOn: '2026-12-28',
            },
        });
        open(
            MEMBER_READY,
            block({
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_above',
                },
            })
        );

        await user.click(await createButton());

        expect(
            await screen.findByText(/그 위로 올라가면 메일로 알려 드려요/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/2026년 12월 28일 종가까지/)
        ).toBeInTheDocument();
    });

    it('비회원이 코드로 만든 결과도 저장된 값으로 바꾼다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({
            status: 'created',
            maskedEmail: 'g***@example.com',
            owner: 'guest',
            stored: STORED,
        });
        open(GUEST_READY);

        await user.click(await createButton());
        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await user.type(await screen.findByLabelText('인증 코드'), '482917');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(
            await screen.findByText(/2026년 12월 28일 종가까지/)
        ).toBeInTheDocument();
        expect(screen.queryByLabelText('인증 코드')).not.toBeInTheDocument();
    });
});

describe('상태를 읽는 동안과 읽은 뒤', () => {
    it('상태를 읽는 동안에는 버튼 자리만 비워 둔다(만들기·건너뛰기 버튼 없음, 서버 호출도 만들기 아님)', async () => {
        actions.state.mockReturnValue(new Promise(() => {}));
        const client = new QueryClient();
        const { container } = render(
            <QueryClientProvider client={client}>
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <PriceAlertProposalCard
                        block={block()}
                        siteUrl={SITE}
                        localePrefix=""
                    />
                </NextIntlClientProvider>
            </QueryClientProvider>
        );

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(container.querySelector('.min-h-11')).not.toBeNull();
        expect(actions.create).not.toHaveBeenCalled();
    });

    it('마운트하면 제안 id가 아니라 토큰으로 상태를 읽는다', async () => {
        open(MEMBER_READY);
        await createButton();

        expect(actions.state).toHaveBeenCalledWith(TOKEN);
    });

    it('이미 만든 제안이면(새로 고침) 만들었다는 문장만 남고 버튼도 만들기 호출도 없다', async () => {
        open({
            status: 'created',
            maskedEmail: 'm***@example.com',
            owner: 'member',
            stored: STORED,
        });

        expect(
            await screen.findByText(
                /만들었어요\. m\*\*\*@example\.com로 보내 드려요\./
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(actions.create).not.toHaveBeenCalled();
        expect(
            screen.getByRole('link', { name: '알림 메일 설정' })
        ).toHaveAttribute('href', `${SITE}/email-report/alerts`);
    });

    it('설정 링크는 로케일 접두사를 따른다', async () => {
        open(
            {
                status: 'created',
                maskedEmail: 'm***@example.com',
                owner: 'member',
                stored: STORED,
            },
            block(),
            '/en'
        );

        expect(
            await screen.findByRole('link', { name: '알림 메일 설정' })
        ).toHaveAttribute('href', `${SITE}/en/email-report/alerts`);
    });

    it.each([
        [{ status: 'exists' }, '이미 같은 알림이 있어요.'],
        [
            { status: 'limit_reached' },
            `가격대 알림은 ${PRICE_ALERT_MAX_ACTIVE}개까지 만들 수 있어요. 알림 메일 설정에서 정리해 주세요.`,
        ],
        [
            { status: 'proposal_expired' },
            '시간이 지나 이 알림은 만들 수 없어요. 다시 요청해 주세요.',
        ],
        [
            { status: 'invalid' },
            '시간이 지나 이 알림은 만들 수 없어요. 다시 요청해 주세요.',
        ],
        [
            { status: 'unavailable' },
            '지금은 만들 수 없어요. 잠시 뒤 다시 시도해 주세요.',
        ],
        ['error', '지금은 만들 수 없어요. 잠시 뒤 다시 시도해 주세요.'],
    ])('상태 %j → 문장만 남고 버튼은 없다', async (state, sentence) => {
        open(state);

        expect(await screen.findByText(sentence)).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});

describe('알림 만들기(회원: 코드 없이 한 번에)', () => {
    it('버튼을 누르면 토큰으로 만들기 액션을 한 번 부르고 결과를 문장으로 알린다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({
            status: 'created',
            maskedEmail: 'm***@example.com',
            owner: 'member',
            stored: STORED,
        });
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(
            await screen.findByText(
                /만들었어요\. m\*\*\*@example\.com로 보내 드려요\./
            )
        ).toBeInTheDocument();
        expect(actions.create).toHaveBeenCalledTimes(1);
        expect(actions.create).toHaveBeenCalledWith(TOKEN);
        expect(
            screen.queryByRole('button', { name: '알림 만들기' })
        ).not.toBeInTheDocument();
    });

    it('더블클릭해도 만들기 요청은 한 번이다', async () => {
        const user = userEvent.setup();
        let resolve: (value: unknown) => void = () => {};
        actions.create.mockReturnValue(
            new Promise(done => {
                resolve = done;
            })
        );
        open(MEMBER_READY);

        const button = await createButton();
        await user.click(button);
        await user.click(button);
        await user.dblClick(button);

        expect(actions.create).toHaveBeenCalledTimes(1);
        expect(button).toHaveAttribute('aria-disabled', 'true');
        resolve({
            status: 'created',
            maskedEmail: 'm***@example.com',
            owner: 'member',
            stored: STORED,
        });
        await screen.findByText(/만들었어요/);
    });

    it.each([
        [{ status: 'exists' }, '이미 같은 알림이 있어요.'],
        [
            { status: 'limit_reached' },
            `가격대 알림은 ${PRICE_ALERT_MAX_ACTIVE}개까지 만들 수 있어요. 알림 메일 설정에서 정리해 주세요.`,
        ],
        [
            { status: 'proposal_expired' },
            '시간이 지나 이 알림은 만들 수 없어요. 다시 요청해 주세요.',
        ],
    ])('결과 %j를 문장으로 알린다', async (result, sentence) => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue(result);
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(await screen.findByText(sentence)).toBeInTheDocument();
    });

    it('이미 조건에 닿았으면(already_met) 그렇게 알리고 버튼은 사라진다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({ status: 'already_met' });
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(
            await screen.findByText(
                '그 사이 가격이 조건에 이미 닿아 알림을 만들지 않았어요.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('시세를 다시 읽지 못했으면(proposal_stale) 다시 요청하라고 안내한다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({ status: 'proposal_stale' });
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(
            await screen.findByText(
                '시간이 지나 이 알림은 만들 수 없어요. 다시 요청해 주세요.'
            )
        ).toBeInTheDocument();
    });

    it('비회원이 만든 알림은 메일 속 설정 링크로 지운다고 안내하고 설정 화면 링크는 달지 않는다', async () => {
        open({
            status: 'created',
            maskedEmail: 'g***@example.com',
            owner: 'guest',
            stored: STORED,
        });

        expect(
            await screen.findByText(
                '만들었어요. g***@example.com로 보내 드려요. 지울 때는 메일 속 설정 링크를 이용해 주세요.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('link', { name: '알림 메일 설정' })
        ).not.toBeInTheDocument();
    });

    it('한도(rate_limited)는 문구를 알리되 버튼은 남겨 다시 누를 수 있다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({ status: 'rate_limited' });
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(
            await screen.findByText('잠시 뒤 다시 시도해 주세요.')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '알림 만들기' })
        ).toBeInTheDocument();
    });

    it('이 브라우저의 신청 기록이 사라졌으면(needs_code) 이메일 단계로 넘어간다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({ status: 'needs_code' });
        open(MEMBER_READY);

        await user.click(await createButton());

        expect(await screen.findByLabelText('이메일')).toBeInTheDocument();
    });
});

describe('알림 만들기(비회원: 이메일과 코드)', () => {
    it('버튼은 서버에 만들기를 요청하지 않고 이메일 단계를 연다(방침 링크는 메인 사이트)', async () => {
        const user = userEvent.setup();
        open(GUEST_READY);

        await user.click(await createButton());

        expect(await screen.findByLabelText('이메일')).toBeInTheDocument();
        expect(actions.create).not.toHaveBeenCalled();
        expect(
            screen.getByRole('link', { name: '개인정보처리방침 보기' })
        ).toHaveAttribute('href', `${SITE}/privacy`);
    });

    it('이메일 → 코드 → 만들었어요: 토큰이 코드 확인 폼에 실려 간다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({
            status: 'created',
            maskedEmail: 'g***@example.com',
            owner: 'guest',
            stored: STORED,
        });
        open(GUEST_READY);

        await user.click(await createButton());
        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        const code = await screen.findByLabelText('인증 코드');
        await user.type(code, '482917');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(
            await screen.findByText(
                /만들었어요\. g\*\*\*@example\.com로 보내 드려요\. 지울 때는 메일 속 설정 링크/
            )
        ).toBeInTheDocument();
        const form = actions.confirm.mock.calls
            .map(call => call[1])
            .find((arg): arg is FormData => arg instanceof FormData);
        expect(Object.fromEntries(form?.entries() ?? [])).toEqual({
            email: 'guest@example.com',
            code: '482917',
            token: TOKEN,
        });
        expect(actions.create).not.toHaveBeenCalled();
    });

    it('코드 확인에서 주소가 틀렸다(invalid_email)면 코드 단계에서 주소를 확인하라고 알린다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({ status: 'invalid_email' });
        open(GUEST_READY);

        await user.click(await createButton());
        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await user.type(await screen.findByLabelText('인증 코드'), '482917');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(
            await screen.findByText('이메일 주소를 확인해 주세요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
    });

    it('틀린 코드는 코드 칸 아래에 알리고 단계에 머문다', async () => {
        const user = userEvent.setup();
        actions.request.mockResolvedValue({
            status: 'code_sent',
            email: 'guest@example.com',
        });
        actions.confirm.mockResolvedValue({ status: 'wrong_code' });
        open(GUEST_READY);

        await user.click(await createButton());
        await user.type(
            await screen.findByLabelText('이메일'),
            'guest@example.com'
        );
        await user.click(
            screen.getByRole('button', { name: '인증 코드 받기' })
        );
        await user.type(await screen.findByLabelText('인증 코드'), '000000');
        await user.click(screen.getByRole('button', { name: '확인하고 받기' }));

        expect(
            await screen.findByText('인증 코드가 맞지 않아요.')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
    });

    it.each([
        ['exists', '이미 같은 알림이 있어요.'],
        [
            'proposal_expired',
            '시간이 지나 이 알림은 만들 수 없어요. 다시 요청해 주세요.',
        ],
    ])(
        '코드 확인 결과 %s는 카드의 문장으로 끝난다',
        async (status, sentence) => {
            const user = userEvent.setup();
            actions.request.mockResolvedValue({
                status: 'code_sent',
                email: 'guest@example.com',
            });
            actions.confirm.mockResolvedValue({ status });
            open(GUEST_READY);

            await user.click(await createButton());
            await user.type(
                await screen.findByLabelText('이메일'),
                'guest@example.com'
            );
            await user.click(
                screen.getByRole('button', { name: '인증 코드 받기' })
            );
            await user.type(
                await screen.findByLabelText('인증 코드'),
                '123456'
            );
            await user.click(
                screen.getByRole('button', { name: '확인하고 받기' })
            );

            expect(await screen.findByText(sentence)).toBeInTheDocument();
            expect(
                screen.queryByLabelText('인증 코드')
            ).not.toBeInTheDocument();
        }
    );

    it('이메일 인증 전 회원이면 계정 주소를 채워 고정한다', async () => {
        const user = userEvent.setup();
        open({ status: 'ready', mode: 'new', accountEmail: 'me@example.com' });

        await user.click(await createButton());

        const email = await screen.findByLabelText('이메일');
        expect(email).toHaveValue('me@example.com');
        expect(email).toHaveAttribute('readonly');
    });
});

describe('만들지 않기', () => {
    it('카드를 접고 안내 한 줄만 남기며 포커스를 카드로 옮긴다(만들기 호출 없음)', async () => {
        const user = userEvent.setup();
        open(MEMBER_READY);

        await user.click(
            await screen.findByRole('button', { name: '만들지 않기' })
        );

        expect(screen.getByText('알림을 만들지 않았어요.')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText(/종가가/)).not.toBeInTheDocument();
        await waitFor(() =>
            expect(
                screen.getByRole('region', { name: '가격대 알림' })
            ).toHaveFocus()
        );
        expect(actions.create).not.toHaveBeenCalled();
    });
});

describe('접근성', () => {
    it('카드는 제목으로 이름 붙은 영역이고 결과는 읽어 주는 영역(aria-live)에 나온다', async () => {
        const user = userEvent.setup();
        actions.create.mockResolvedValue({ status: 'exists' });
        const { container } = open(MEMBER_READY);

        await user.click(await createButton());
        await screen.findByText('이미 같은 알림이 있어요.');

        expect(
            screen.getByRole('region', { name: '가격대 알림' })
        ).toBeInTheDocument();
        const live = container.querySelector('[aria-live="polite"]');
        expect(live).toHaveTextContent('이미 같은 알림이 있어요.');
    });

    it('버튼은 44px 목표 높이를 갖는다', async () => {
        open(MEMBER_READY);

        expect(await createButton()).toHaveClass('h-11');
        expect(screen.getByRole('button', { name: '만들지 않기' })).toHaveClass(
            'min-h-11'
        );
    });
});
