import type {
    EmailTokenPurpose,
    EmailTokenStore,
    EmailTokenValue,
} from '@/entities/email-token/types';
import {
    PRICE_ALERT_MAX_ACTIVE,
    PRICE_ALERT_RATE_LIMIT,
} from '@/entities/mail-alert/lib/priceAlertConstants';
import type { PriceAlertProposal } from '@/entities/mail-alert/model';
import { requestMailAlertCodeFlow } from '@/entities/mail-alert/server/mailAlertFlows';
import {
    confirmPriceAlertFlow,
    createPriceAlertFlow,
    getPriceAlertProposalState,
    type PriceAlertFlowDeps,
} from '@/entities/mail-alert/server/priceAlertFlows';
import type {
    CancelPriceAlertOutcome,
    CreatePriceAlertInput,
    CreatePriceAlertOutcome,
    MailAlertOwner,
    MailAlertSubscriberRecord,
    PriceAlertRecord,
    UpsertVerifiedMailAlertSubscriberInput,
} from '@/shared/db/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { defined } from '@/shared/test-utils/defined';

const NOW = new Date('2026-11-25T15:00:00Z');
const SUBJECT = 'subject-hash-of-the-caller';

function user(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
    return {
        id: 'user-1',
        email: 'member@example.com',
        name: null,
        avatarUrl: null,
        tier: 'member',
        emailVerified: true,
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

function proposal(
    overrides: Partial<PriceAlertProposal> = {}
): PriceAlertProposal {
    return {
        proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
        subject: SUBJECT,
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        quoteAt: null,
        startsAfterSession: '2026-11-24',
        expiresOn: '2026-12-24',
        exp: Math.floor(NOW.getTime() / 1000) + 3_600,
        ...overrides,
    };
}

/** 소유자 규칙을 그대로 흉내 낸 메모리 구독자 저장소(회원은 `user_id`, 비회원은 id + `user_id` 없음). */
class FakeSubscribers {
    readonly rows = new Map<string, MailAlertSubscriberRecord>();
    readonly upserts: UpsertVerifiedMailAlertSubscriberInput[] = [];
    private counter = 0;

    constructor(private readonly accounts: readonly AuthUserRecord[]) {}

    rowOf(owner: MailAlertOwner): MailAlertSubscriberRecord | null {
        return (
            [...this.rows.values()].find(row => {
                switch (owner.kind) {
                    case 'member':
                        return row.userId === owner.userId;
                    case 'guest':
                        return (
                            row.id === owner.subscriberId && row.userId === null
                        );
                    case 'link':
                        return row.id === owner.subscriberId;
                }
            }) ?? null
        );
    }

    seed(email: string, userId: string | null = null): string {
        this.counter += 1;
        const id = `sub-${this.counter}`;
        this.rows.set(id, {
            id,
            email,
            userId,
            locale: 'ko',
            includePortfolio: false,
            consentedAt: NOW,
            consentSource: 'symbol',
            createdAt: NOW,
            updatedAt: NOW,
        });
        return id;
    }

    private verifiedOwnerOf(email: string): string | null {
        const account = this.accounts.find(
            candidate => candidate.email === email && candidate.emailVerified
        );
        const alreadyLinked = [...this.rows.values()].some(
            row => row.userId === account?.id
        );
        return account === undefined || alreadyLinked ? null : account.id;
    }

    async upsertVerified(input: UpsertVerifiedMailAlertSubscriberInput) {
        this.upserts.push(input);
        const existing = [...this.rows.values()].find(
            row => row.email === input.email
        );
        if (existing !== undefined) {
            this.rows.set(existing.id, {
                ...existing,
                userId: existing.userId ?? this.verifiedOwnerOf(input.email),
            });
            return { id: existing.id, created: false };
        }
        const id = this.seed(input.email, this.verifiedOwnerOf(input.email));
        this.rows.set(id, {
            ...(this.rows.get(id) as MailAlertSubscriberRecord),
            consentSource: input.consentSource,
        });
        return { id, created: true };
    }

    async findByOwner(owner: MailAlertOwner) {
        return this.rowOf(owner);
    }

    async findForMember(userId: string) {
        const linked = this.rowOf({ kind: 'member', userId });
        if (linked !== null) return linked;
        const account = this.accounts.find(
            candidate => candidate.id === userId && candidate.emailVerified
        );
        const adoptable = [...this.rows.values()].find(
            row => row.userId === null && row.email === account?.email
        );
        if (adoptable === undefined) return null;
        const adopted = { ...adoptable, userId };
        this.rows.set(adopted.id, adopted);
        return adopted;
    }

    async linkVerifiedMember(userId: string, subscriberId: string) {
        const account = this.accounts.find(
            candidate => candidate.id === userId
        );
        const row = this.rows.get(subscriberId);
        const alreadyHasRow = [...this.rows.values()].some(
            candidate => candidate.userId === userId
        );
        if (
            row === undefined ||
            row.userId !== null ||
            row.email !== account?.email ||
            alreadyHasRow
        ) {
            return false;
        }
        this.rows.set(subscriberId, { ...row, userId });
        return true;
    }

    // 이 흐름이 쓰지 않는 메서드 — 인터페이스(Pick)만 채운다.
    async listTopics() {
        return [];
    }
    async addTopic() {
        return 'added' as const;
    }
    async removeTopic() {
        return { deleted: false, subscriberDeleted: false };
    }
    async setIncludePortfolio() {
        return { found: false, subscriberDeleted: false };
    }
    async deleteByOwner() {
        return false;
    }
}

/** 알림 저장소의 규칙(같은 제안 id → exists, 같은 가격대 → duplicate, 상한)을 흉내 낸 메모리 구현. */
class FakePriceAlerts {
    readonly alerts: PriceAlertRecord[] = [];
    readonly createCalls: Array<{
        owner: MailAlertOwner;
        input: CreatePriceAlertInput;
        max: number;
    }> = [];

    constructor(private readonly subscribers: FakeSubscribers) {}

    async createWithinLimit(
        owner: MailAlertOwner,
        input: CreatePriceAlertInput,
        max: number
    ): Promise<CreatePriceAlertOutcome> {
        this.createCalls.push({ owner, input, max });
        const row = this.subscribers.rowOf(owner);
        if (row === null) return 'subscriber_missing';
        const mine = this.alerts.filter(a => a.subscriberId === row.id);
        if (mine.some(a => a.proposalId === input.proposalId)) return 'exists';
        const live = mine.filter(a => a.status === 'active');
        if (
            live.some(
                a =>
                    a.symbol === input.symbol &&
                    JSON.stringify(a.condition) ===
                        JSON.stringify(input.condition)
            )
        ) {
            return 'duplicate';
        }
        if (live.length >= max) return 'limit_reached';
        this.alerts.push({
            id: `alert-${this.alerts.length + 1}`,
            subscriberId: row.id,
            firedSession: null,
            firedClose: null,
            firedAt: null,
            status: 'active',
            createdAt: NOW,
            ...input,
        });
        return 'created';
    }

    async findByProposal(owner: MailAlertOwner, proposalId: string) {
        const row = this.subscribers.rowOf(owner);
        return (
            this.alerts.find(
                a => a.subscriberId === row?.id && a.proposalId === proposalId
            ) ?? null
        );
    }

    async countActive(owner: MailAlertOwner) {
        const row = this.subscribers.rowOf(owner);
        return this.alerts.filter(
            a => a.subscriberId === row?.id && a.status === 'active'
        ).length;
    }

    /** 이 파일의 흐름은 목록·지우기를 부르지 않는다. 타입만 채운다. */
    async listForSubscriber(): Promise<PriceAlertRecord[]> {
        return [];
    }

    async cancel(): Promise<CancelPriceAlertOutcome> {
        return { deleted: false, subscriberDeleted: false };
    }
}

function memoryTokens(): EmailTokenStore {
    const entries = new Map<string, EmailTokenValue>();
    const keyOf = (purpose: EmailTokenPurpose, email: string) =>
        `${purpose}:${email}`;
    return {
        async set(purpose, email, value) {
            entries.set(keyOf(purpose, email), value);
        },
        async get(purpose, email) {
            return entries.get(keyOf(purpose, email)) ?? null;
        },
        async delete(purpose, email) {
            entries.delete(keyOf(purpose, email));
        },
        async consume(purpose, email) {
            const value = entries.get(keyOf(purpose, email)) ?? null;
            entries.delete(keyOf(purpose, email));
            return value;
        },
    };
}

interface Setup {
    readonly deps: PriceAlertFlowDeps;
    readonly subscribers: FakeSubscribers;
    readonly priceAlerts: FakePriceAlerts;
    readonly cookie: {
        readonly value: { current: string | null };
        readonly write: ReturnType<typeof vi.fn>;
        readonly clear: ReturnType<typeof vi.fn>;
    };
    readonly sendEmail: ReturnType<typeof vi.fn>;
    readonly rateLimit: ReturnType<typeof vi.fn>;
    readonly verifyProposal: ReturnType<typeof vi.fn>;
    readonly readReference: ReturnType<typeof vi.fn>;
}

interface SetupOptions {
    readonly account?: AuthUserRecord | null;
    readonly accounts?: readonly AuthUserRecord[];
    readonly cookieId?: string | null;
    readonly proposal?: PriceAlertProposal | null;
    readonly subject?: string | null;
    readonly launched?: boolean;
    readonly priceAlertsEnabled?: boolean;
    readonly rateLimit?: (rule: { key: string }) => boolean;
    readonly emailTokens?: EmailTokenStore | null;
    /** 제안 뒤 세션이 마감됐을 때 다시 읽는 가격. `null`이면 읽지 못한 것이다. */
    readonly reference?: {
        price: number;
        quoteAt: string | null;
        referenceClose: number;
    } | null;
}

function setup(options: SetupOptions = {}): Setup {
    const account = options.account ?? null;
    const accounts = options.accounts ?? (account === null ? [] : [account]);
    const subscribers = new FakeSubscribers(accounts);
    const priceAlerts = new FakePriceAlerts(subscribers);
    const cookieValue = { current: options.cookieId ?? null };
    const write = vi.fn(async (id: string) => {
        cookieValue.current = id;
    });
    const clear = vi.fn(async () => {
        cookieValue.current = null;
    });
    const sendEmail = vi.fn().mockResolvedValue(true);
    const rateLimit = vi.fn(async (rule: { key: string }) =>
        options.rateLimit === undefined ? true : options.rateLimit(rule)
    );
    const verifyProposal = vi.fn(() =>
        options.proposal === undefined ? proposal() : options.proposal
    );
    const readReference = vi.fn(async () =>
        options.reference === undefined
            ? { price: 190, quoteAt: null, referenceClose: 188 }
            : options.reference
    );
    const deps: PriceAlertFlowDeps = {
        launched: options.launched ?? true,
        signingReady: true,
        subscribers,
        users: {
            findByEmail: async email =>
                accounts.find(candidate => candidate.email === email) ?? null,
        } as PriceAlertFlowDeps['users'],
        currentUser: async () => account,
        guestCookie: { read: async () => cookieValue.current, write, clear },
        verifyLink: () => false,
        rateLimit,
        resetCounter: async () => {},
        ipHash: async () => 'ip-hash',
        emailTokens:
            options.emailTokens === undefined
                ? memoryTokens()
                : options.emailTokens,
        emailDispatcher: { sendEmail },
        buildCodeMessage: (to, code) => ({
            to,
            subject: 'code',
            html: code,
            text: code,
        }),
        locale: 'ko',
        priceAlertsEnabled: options.priceAlertsEnabled ?? true,
        priceAlerts,
        verifyProposal,
        callerSubject: async () =>
            options.subject === undefined ? SUBJECT : options.subject,
        readReference,
        now: () => NOW.getTime(),
    };
    return {
        deps,
        subscribers,
        priceAlerts,
        cookie: { value: cookieValue, write, clear },
        sendEmail,
        rateLimit,
        verifyProposal,
        readReference,
    };
}

async function issueCode(context: Setup, email: string): Promise<string> {
    await requestMailAlertCodeFlow(context.deps, {
        email,
        honeypotFilled: false,
    });
    const message = context.sendEmail.mock.calls
        .filter(
            (call): call is [{ to: string; text: string }] =>
                call[0]?.to === email
        )
        .at(-1)?.[0];
    return message?.text ?? '';
}

const TOKEN = 'signed-token';

describe('공개 전·준비 안 됨', () => {
    it.each([{ launched: false }, { priceAlertsEnabled: false }])(
        '어느 흐름이든 unavailable이고 토큰도 읽지 않는다 (%j)',
        async options => {
            const context = setup({ account: user(), ...options });

            await expect(
                getPriceAlertProposalState(context.deps, TOKEN)
            ).resolves.toEqual({ status: 'unavailable' });
            await expect(
                createPriceAlertFlow(context.deps, TOKEN)
            ).resolves.toEqual({
                status: 'unavailable',
            });
            await expect(
                confirmPriceAlertFlow(context.deps, {
                    email: 'a@example.com',
                    code: '123456',
                    token: TOKEN,
                })
            ).resolves.toEqual({ status: 'unavailable' });
            expect(context.verifyProposal).not.toHaveBeenCalled();
            expect(context.priceAlerts.createCalls).toHaveLength(0);
        }
    );
});

describe('제안 확인(서명·만료·소유자)', () => {
    it('서명이 틀리거나 모양이 깨진 토큰은 invalid이고 아무것도 만들지 않는다', async () => {
        const context = setup({ account: user(), proposal: null });

        await expect(
            createPriceAlertFlow(context.deps, 'bad')
        ).resolves.toEqual({
            status: 'invalid',
        });
        await expect(
            getPriceAlertProposalState(context.deps, 'bad')
        ).resolves.toEqual({ status: 'invalid' });
        expect(context.priceAlerts.createCalls).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('만료된 제안은 proposal_expired다(정각에도 만료)', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ exp: Math.floor(NOW.getTime() / 1000) }),
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'proposal_expired' });
        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'proposal_expired' });
    });

    it('만료 1초 전 제안은 아직 만들 수 있다', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ exp: Math.floor(NOW.getTime() / 1000) + 1 }),
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toMatchObject({ status: 'created' });
    });

    it.each([
        ['다른 사람의 토큰', 'someone-elses-subject'],
        ['알아볼 수 없는 호출자', null],
    ])('%s는 invalid이고 한도도 쓰지 않는다', async (_label, subject) => {
        const context = setup({ account: user(), subject });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({
            status: 'invalid',
        });
        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: 'member@example.com',
                code: '123456',
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'invalid' });
        expect(context.rateLimit).not.toHaveBeenCalled();
        expect(context.priceAlerts.createCalls).toHaveLength(0);
    });
});

describe('getPriceAlertProposalState', () => {
    it('알아볼 수 없는 방문자는 코드 확인이 필요하다', async () => {
        const context = setup();

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({
            status: 'ready',
            mode: 'new',
            accountEmail: null,
        });
    });

    it('이메일 인증 전 회원은 계정 주소를 채워 코드 확인으로 안내한다', async () => {
        const context = setup({ account: user({ emailVerified: false }) });

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({
            status: 'ready',
            mode: 'new',
            accountEmail: 'member@example.com',
        });
    });

    it('이메일이 인증된 회원은 코드 없이 만들 수 있고 주소는 가려서 보인다', async () => {
        const context = setup({ account: user() });

        const state = await getPriceAlertProposalState(context.deps, TOKEN);

        expect(state).toMatchObject({ status: 'ready', mode: 'member' });
        expect(JSON.stringify(state)).not.toContain('member@example.com');
    });

    it('같은 브라우저에서 신청한 비회원은 known이다', async () => {
        const context = setup();
        const id = context.subscribers.seed('guest@example.com');
        context.cookie.value.current = id;

        const state = await getPriceAlertProposalState(context.deps, TOKEN);

        expect(state).toMatchObject({ status: 'ready', mode: 'known' });
        expect(JSON.stringify(state)).not.toContain('guest@example.com');
    });

    it('쿠키가 가리키던 행이 없으면 쿠키만 비우고 코드 확인으로 안내한다', async () => {
        const context = setup({ cookieId: 'gone' });

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({
            status: 'ready',
            mode: 'new',
            accountEmail: null,
        });
        expect(context.cookie.clear).toHaveBeenCalledTimes(1);
    });

    it('만료된 뒤에 대화를 다시 열어도, 이미 만든 알림은 created로 남는다', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        context.verifyProposal.mockReturnValue(
            proposal({ exp: Math.floor(NOW.getTime() / 1000) - 3_600 })
        );

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toMatchObject({ status: 'created' });
    });

    it('만료됐고 만든 적이 없으면 어느 호출자든 proposal_expired다(상한이어도)', async () => {
        const expired = proposal({ exp: Math.floor(NOW.getTime() / 1000) - 1 });
        for (const options of [
            {},
            { account: user({ emailVerified: false }) },
            { account: user() },
        ]) {
            const context = setup({ ...options, proposal: expired });
            await expect(
                getPriceAlertProposalState(context.deps, TOKEN)
            ).resolves.toEqual({ status: 'proposal_expired' });
        }
    });

    it('만료돼도 다른 사람의 토큰이면 invalid다(만들었는지도 알려 주지 않는다)', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ exp: 1 }),
            subject: 'someone-else',
        });

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'invalid' });
    });

    it('이미 이 제안으로 만든 알림이 있으면 created다(새로 고침해도 남는다)', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toMatchObject({ status: 'created' });
    });

    it('살아 있는 알림이 상한이면 limit_reached다', async () => {
        const context = setup({ account: user() });
        for (let i = 0; i < PRICE_ALERT_MAX_ACTIVE; i += 1) {
            await createPriceAlertFlow(context.deps, TOKEN);
            const created = defined(context.priceAlerts.alerts.at(-1));
            created.symbol = `S${i}`;
            created.proposalId = `p-${i}`;
        }

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'limit_reached' });
    });

    it('상태를 읽는 것은 한도를 쓰지 않고 아무것도 만들지 않는다', async () => {
        const context = setup({ account: user() });

        await getPriceAlertProposalState(context.deps, TOKEN);

        expect(context.rateLimit).not.toHaveBeenCalled();
        expect(context.priceAlerts.createCalls).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(0);
    });
});

describe('createPriceAlertFlow', () => {
    it('인증된 회원은 코드 없이 만든다: agent_chat 동의로 구독자를 만들고 제안의 값을 그대로 저장한다', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({
                analysisAt: '2026-11-25T12:00:00.000Z',
                basis: 'analysis_entry_zone',
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_above',
                },
            }),
        });

        const result = await createPriceAlertFlow(context.deps, TOKEN);

        expect(result).toMatchObject({ status: 'created' });
        expect(JSON.stringify(result)).not.toContain('member@example.com');
        expect(context.subscribers.upserts).toEqual([
            {
                email: 'member@example.com',
                locale: 'ko',
                consentSource: 'agent_chat',
            },
        ]);
        expect(context.priceAlerts.createCalls).toEqual([
            {
                owner: { kind: 'member', userId: 'user-1' },
                max: PRICE_ALERT_MAX_ACTIVE,
                input: {
                    proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
                    symbol: 'AAPL',
                    market: 'us',
                    condition: {
                        kind: 'enter_zone',
                        low: 178,
                        high: 181.5,
                        approach: 'from_above',
                    },
                    basis: 'analysis_entry_zone',
                    analysisAt: new Date('2026-11-25T12:00:00.000Z'),
                    referenceClose: 190,
                    startsAfterSession: '2026-11-24',
                    expiresOn: '2026-12-24',
                },
            },
        ]);
    });

    it('이미 구독자인 회원은 구독자를 다시 만들지 않는다', async () => {
        const context = setup({ account: user() });
        context.subscribers.seed('member@example.com', 'user-1');

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.subscribers.upserts).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(1);
    });

    it('더블클릭·재시도는 알림 하나만 만들고 둘 다 created다', async () => {
        const context = setup({ account: user() });

        const first = await createPriceAlertFlow(context.deps, TOKEN);
        const second = await createPriceAlertFlow(context.deps, TOKEN);

        expect(first).toMatchObject({ status: 'created' });
        expect(second).toMatchObject({ status: 'created' });
        expect(context.priceAlerts.alerts).toHaveLength(1);
    });

    it('같은 가격대의 살아 있는 알림이 이미 있으면 다른 제안은 exists다', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        context.verifyProposal.mockReturnValue(
            proposal({ proposalId: '0f0f0f0f-3d41-4a6a-9a5c-0a3b6f7d9e10' })
        );

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'exists' });
        expect(context.priceAlerts.alerts).toHaveLength(1);
    });

    it('상한(10)에서는 limit_reached다', async () => {
        const context = setup({ account: user() });
        const id = context.subscribers.seed('member@example.com', 'user-1');
        for (let i = 0; i < PRICE_ALERT_MAX_ACTIVE; i += 1) {
            context.priceAlerts.alerts.push({
                id: `a-${i}`,
                subscriberId: id,
                proposalId: `p-${i}`,
                symbol: `S${i}`,
                market: 'us',
                condition: { kind: 'close_below', level: 1 + i },
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 10,
                startsAfterSession: '2026-11-24',
                expiresOn: '2026-12-24',
                status: 'active',
                firedSession: null,
                firedClose: null,
                firedAt: null,
                createdAt: NOW,
            });
        }

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'limit_reached' });
    });

    it('IP 해시 한도를 넘으면 rate_limited이고 아무것도 만들지 않는다', async () => {
        const context = setup({ account: user(), rateLimit: () => false });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.priceAlerts.createCalls).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('한도 키는 IP 해시이고 규칙은 가격대 알림 만들기 한도(시간당 20)다', async () => {
        const context = setup({ account: user() });

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.rateLimit).toHaveBeenCalledWith({
            key: 'price-alert:create:ip:ip-hash',
            ...PRICE_ALERT_RATE_LIMIT.createPerIp,
        });
    });

    it('같은 브라우저에서 신청한 비회원(쿠키)은 그 행에 만든다', async () => {
        const context = setup();
        const id = context.subscribers.seed('guest@example.com');
        context.cookie.value.current = id;

        const result = await createPriceAlertFlow(context.deps, TOKEN);

        expect(result).toMatchObject({ status: 'created' });
        expect(context.priceAlerts.createCalls[0]?.owner).toEqual({
            kind: 'guest',
            subscriberId: id,
        });
        expect(context.subscribers.upserts).toHaveLength(0);
    });

    it.each([
        ['알아볼 수 없는 방문자', {}],
        ['이메일 인증 전 회원', { account: user({ emailVerified: false }) }],
    ])(
        '%s는 needs_code이고 아무것도 만들지 않는다',
        async (_label, options) => {
            const context = setup(options);

            await expect(
                createPriceAlertFlow(context.deps, TOKEN)
            ).resolves.toEqual({ status: 'needs_code' });
            expect(context.priceAlerts.createCalls).toHaveLength(0);
            expect(context.subscribers.rows.size).toBe(0);
        }
    );

    it('쿠키가 가리키던 구독자가 사라졌으면 쿠키를 비우고 needs_code다', async () => {
        const context = setup({ cookieId: 'unsubscribed-meanwhile' });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'needs_code' });
        expect(context.cookie.clear).toHaveBeenCalledTimes(1);
    });
});

describe('confirmPriceAlertFlow', () => {
    const GUEST_EMAIL = 'guest@example.com';

    it('제안을 먼저 확인한다: 만료·다른 사람의 제안은 코드를 쓰지 않고 거절한다', async () => {
        const context = setup({
            proposal: proposal({ exp: Math.floor(NOW.getTime() / 1000) - 1 }),
        });
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'proposal_expired' });
        // 코드는 그대로 남아 있다 — 같은 코드로 새 제안에서 확인할 수 있다.
        context.verifyProposal.mockReturnValue(proposal());
        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toMatchObject({ status: 'created' });
    });

    it('올바른 코드면 agent_chat 동의로 구독자를 만들고 알림을 만들며 쿠키를 심는다', async () => {
        const context = setup();
        const code = await issueCode(context, GUEST_EMAIL);

        const result = await confirmPriceAlertFlow(context.deps, {
            email: GUEST_EMAIL,
            code,
            token: TOKEN,
        });

        expect(result).toMatchObject({ status: 'created' });
        expect(JSON.stringify(result)).not.toContain(GUEST_EMAIL);
        expect(context.subscribers.upserts).toEqual([
            { email: GUEST_EMAIL, locale: 'ko', consentSource: 'agent_chat' },
        ]);
        expect(context.priceAlerts.alerts).toHaveLength(1);
        expect(context.cookie.write).toHaveBeenCalledWith(
            context.priceAlerts.alerts[0]?.subscriberId
        );
    });

    it('틀린 코드는 wrong_code이고 구독자도 알림도 쿠키도 없다', async () => {
        const context = setup();
        await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code: '000000',
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'wrong_code' });
        expect(context.subscribers.rows.size).toBe(0);
        expect(context.priceAlerts.alerts).toHaveLength(0);
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('형식이 틀린 주소는 invalid_email이다(제안이 틀린 invalid와 구분해 코드 단계가 주소를 다시 보게 한다)', async () => {
        const context = setup();

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: 'not-an-email',
                code: '123456',
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'invalid_email' });
        expect(context.priceAlerts.alerts).toHaveLength(0);
    });

    it('같은 주소의 인증된 회원이 있으면 알림은 그 회원 소유이고 쿠키는 필요 없다', async () => {
        const context = setup({
            account: user({ email: GUEST_EMAIL }),
            subject: SUBJECT,
        });
        const code = await issueCode(context, GUEST_EMAIL);

        const result = await confirmPriceAlertFlow(context.deps, {
            email: GUEST_EMAIL,
            code,
            token: TOKEN,
        });

        expect(result).toMatchObject({ status: 'created' });
        expect(context.priceAlerts.alerts).toHaveLength(1);
        const row = [...context.subscribers.rows.values()][0];
        expect(row?.userId).toBe('user-1');
        expect(context.priceAlerts.alerts[0]?.subscriberId).toBe(row?.id);
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('상한이면 limit_reached이고 이미 확인한 브라우저라 쿠키는 심는다', async () => {
        const context = setup();
        const id = context.subscribers.seed(GUEST_EMAIL);
        for (let i = 0; i < PRICE_ALERT_MAX_ACTIVE; i += 1) {
            context.priceAlerts.alerts.push({
                id: `a-${i}`,
                subscriberId: id,
                proposalId: `p-${i}`,
                symbol: `S${i}`,
                market: 'us',
                condition: { kind: 'close_below', level: 1 + i },
                basis: 'price_level',
                analysisAt: null,
                referenceClose: 10,
                startsAfterSession: '2026-11-24',
                expiresOn: '2026-12-24',
                status: 'active',
                firedSession: null,
                firedClose: null,
                firedAt: null,
                createdAt: NOW,
            });
        }
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'limit_reached' });
        expect(context.cookie.write).toHaveBeenCalledWith(id);
    });

    it('만들기 한도를 넘으면 rate_limited이고 코드를 쓰지 않는다', async () => {
        const context = setup({
            rateLimit: rule => !rule.key.startsWith('price-alert:create'),
        });
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.priceAlerts.alerts).toHaveLength(0);
    });

    it('코드를 저장할 곳(Redis)이 없으면 unavailable이다', async () => {
        const context = setup({ emailTokens: null });

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code: '123456',
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'unavailable' });
    });
});

describe('만든 결과는 저장된 값을 돌려준다', () => {
    it('created에 저장된 조건과 마지막 판정 세션이 실린다(제안의 만료일이 낡았어도 만든 시각 기준 값)', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ expiresOn: '2026-11-30' }),
        });

        const result = await createPriceAlertFlow(context.deps, TOKEN);

        expect(result).toMatchObject({
            status: 'created',
            owner: 'member',
            stored: {
                condition: { kind: 'close_below', level: 180 },
                expiresOn: '2026-12-24',
            },
        });
    });

    it('재시도(exists)는 처음 만든 값을 돌려준다 — 다시 계산한 값이 아니다', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        context.verifyProposal.mockReturnValue(
            proposal({ condition: { kind: 'close_below', level: 170 } })
        );

        const retry = await createPriceAlertFlow(context.deps, TOKEN);

        expect(retry).toMatchObject({
            status: 'created',
            stored: { condition: { kind: 'close_below', level: 180 } },
        });
    });

    it('상태를 다시 읽어도 저장된 값이 나온다(비회원은 owner가 guest)', async () => {
        const context = setup();
        const id = context.subscribers.seed('guest@example.com');
        context.cookie.value.current = id;
        await createPriceAlertFlow(context.deps, TOKEN);

        await expect(
            getPriceAlertProposalState(context.deps, TOKEN)
        ).resolves.toMatchObject({
            status: 'created',
            owner: 'guest',
            stored: { expiresOn: '2026-12-24' },
        });
    });
});

describe('같은 토큰의 재시도는 저장된 알림을 돌려준다', () => {
    const GUEST_EMAIL = 'guest@example.com';

    it('세션이 마감된 뒤 다시 눌러도(시세 재조회가 막히는 상황) created와 처음 저장된 값이다', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        // 이후 제안 기준 세션이 낡아졌고, 시세를 다시 읽지 못하며 이미 조건도 지났다.
        const later = proposal({ startsAfterSession: '2026-11-20' });
        context.verifyProposal.mockReturnValue(later);
        context.readReference.mockResolvedValue(null);

        const retry = await createPriceAlertFlow(context.deps, TOKEN);

        expect(retry).toMatchObject({
            status: 'created',
            stored: { expiresOn: '2026-12-24' },
        });
        expect(context.priceAlerts.alerts).toHaveLength(1);
        expect(context.readReference).not.toHaveBeenCalled();
    });

    it('제안이 만료된 뒤 다시 눌러도 created다(하루 뒤, 다른 탭, 응답을 잃은 경우)', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        context.verifyProposal.mockReturnValue(
            proposal({ exp: Math.floor(NOW.getTime() / 1000) - 3_600 })
        );

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toMatchObject({ status: 'created' });
    });

    it('만든 적이 없는 만료된 제안은 여전히 proposal_expired다', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ exp: Math.floor(NOW.getTime() / 1000) - 1 }),
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'proposal_expired' });
    });

    it('소유자가 다른 토큰은 만든 알림이 있어도 읽지 않는다(invalid)', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        const other = setup({
            account: user({ id: 'user-2' }),
            subject: 'someone-else',
        });
        other.priceAlerts.alerts.push(...context.priceAlerts.alerts);

        await expect(createPriceAlertFlow(other.deps, TOKEN)).resolves.toEqual({
            status: 'invalid',
        });
    });

    it('다른 회원의 알림은 같은 제안 id여도 돌려주지 않는다(소유자 조건 안에서만 읽는다)', async () => {
        const context = setup({ account: user() });
        await createPriceAlertFlow(context.deps, TOKEN);
        // 두 번째 회원: 같은 제안 id를 가졌지만 자기 구독자 행에는 그 알림이 없다.
        const second = setup({
            account: user({ id: 'user-2', email: 'second@example.com' }),
        });
        // 첫 회원의 구독자 행 id(sub-1)가 둘째 회원의 행과 겹치지 않게 둘째 쪽 번호를 하나 건너뛴다.
        second.subscribers.seed('unrelated@example.com');
        second.priceAlerts.alerts.push(...context.priceAlerts.alerts);

        const result = await createPriceAlertFlow(second.deps, TOKEN);

        expect(result).toMatchObject({ status: 'created' });
        expect(second.priceAlerts.alerts).toHaveLength(2);
    });

    it('코드 확인 흐름도 같다: 쿠키가 있는 비회원이 만든 뒤의 재시도는 코드를 쓰지 않고 created다', async () => {
        const context = setup();
        const id = context.subscribers.seed(GUEST_EMAIL);
        context.cookie.value.current = id;
        await createPriceAlertFlow(context.deps, TOKEN);
        context.verifyProposal.mockReturnValue(
            proposal({ exp: Math.floor(NOW.getTime() / 1000) - 1 })
        );

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code: '000000',
                token: TOKEN,
            })
        ).resolves.toMatchObject({ status: 'created', owner: 'guest' });
    });
});

describe('만드는 시각 기준으로 창을 다시 정한다', () => {
    const GUEST_EMAIL = 'guest@example.com';
    /** NOW 기준 마지막 마감 세션은 11-24다 — 제안이 11-23을 기준으로 만들어졌다면 그 사이 세션이 하나 마감된 것이다. */
    const OLD = proposal({
        startsAfterSession: '2026-11-23',
        expiresOn: '2026-12-23',
    });

    it('마감된 세션이 없으면 시세를 다시 읽지 않고 제안의 기준 종가를 쓴다', async () => {
        const context = setup({ account: user() });

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.readReference).not.toHaveBeenCalled();
        expect(context.priceAlerts.createCalls[0]?.input).toMatchObject({
            startsAfterSession: '2026-11-24',
            referenceClose: 190,
        });
    });

    it('마지막 판정 세션은 만드는 시각 기준으로 다시 계산한다(제안 때의 값을 쓰지 않는다)', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({ expiresOn: '2026-11-30' }),
        });

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.priceAlerts.createCalls[0]?.input.expiresOn).toBe(
            '2026-12-24'
        );
    });

    it('만들기 한도에 막힌 요청은 세션이 마감됐어도 시세를 다시 읽지 않는다(버튼)', async () => {
        const context = setup({
            account: user(),
            proposal: OLD,
            rateLimit: rule => !rule.key.startsWith('price-alert:create'),
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.readReference).not.toHaveBeenCalled();
        expect(context.priceAlerts.createCalls).toHaveLength(0);
    });

    it('만들기 한도에 막힌 요청은 세션이 마감됐어도 시세를 다시 읽지 않는다(코드 확인)', async () => {
        const context = setup({
            proposal: OLD,
            rateLimit: rule => !rule.key.startsWith('price-alert:create'),
        });
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.readReference).not.toHaveBeenCalled();
        expect(context.priceAlerts.alerts).toHaveLength(0);
    });

    it('한도 안이면 같은 마감 뒤 요청은 시세를 다시 읽는다(위 두 검사의 대조군)', async () => {
        const context = setup({ account: user(), proposal: OLD });

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.readReference).toHaveBeenCalledTimes(1);
    });

    it('그 사이 세션이 마감됐으면 새 기준 세션으로 저장하고 시세·종가를 다시 읽어 쓴다', async () => {
        const context = setup({
            account: user(),
            proposal: OLD,
            reference: { price: 192, quoteAt: null, referenceClose: 191.5 },
        });

        const result = await createPriceAlertFlow(context.deps, TOKEN);

        expect(result).toMatchObject({ status: 'created' });
        expect(context.readReference).toHaveBeenCalledWith(
            OLD,
            '2026-11-24',
            NOW
        );
        expect(context.priceAlerts.createCalls[0]?.input).toMatchObject({
            startsAfterSession: '2026-11-24',
            referenceClose: 191.5,
            expiresOn: '2026-12-24',
        });
    });

    it('새 시세가 이미 조건을 충족했으면 만들지 않고 already_met이다(구독자도 만들지 않는다)', async () => {
        const context = setup({
            account: user(),
            proposal: OLD,
            reference: { price: 175, quoteAt: null, referenceClose: 176 },
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'already_met' });
        expect(context.priceAlerts.createCalls).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(0);
        // 한도는 시세를 다시 읽기 전에 한 번 본다(막힌 요청이 공급자 호출을 일으키지 않게).
        expect(context.rateLimit).toHaveBeenCalledTimes(1);
        expect(context.readReference).toHaveBeenCalledTimes(1);
    });

    it('경계 가격(종가 <= 조건)도 충족이다', async () => {
        const context = setup({
            account: user(),
            proposal: OLD,
            reference: { price: 180, quoteAt: null, referenceClose: 181 },
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'already_met' });
    });

    it('새 시세가 구간 안이면 already_met이다', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({
                startsAfterSession: '2026-11-23',
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_above',
                },
            }),
            reference: { price: 180, quoteAt: null, referenceClose: 180 },
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'already_met' });
    });

    it('구간 알림은 새 시세가 반대편이면 그쪽으로 다시 닻을 내린다(approach)', async () => {
        const context = setup({
            account: user(),
            proposal: proposal({
                startsAfterSession: '2026-11-23',
                condition: {
                    kind: 'enter_zone',
                    low: 178,
                    high: 181.5,
                    approach: 'from_above',
                },
            }),
            reference: { price: 170, quoteAt: null, referenceClose: 171 },
        });

        await createPriceAlertFlow(context.deps, TOKEN);

        expect(context.priceAlerts.createCalls[0]?.input.condition).toEqual({
            kind: 'enter_zone',
            low: 178,
            high: 181.5,
            approach: 'from_below',
        });
    });

    it('시세를 다시 읽지 못하면 만들지 않고 proposal_stale(다시 요청)이다', async () => {
        const context = setup({
            account: user(),
            proposal: OLD,
            reference: null,
        });

        await expect(
            createPriceAlertFlow(context.deps, TOKEN)
        ).resolves.toEqual({ status: 'proposal_stale' });
        expect(context.priceAlerts.createCalls).toHaveLength(0);
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('코드 확인 흐름도 같다: 거절하는 요청은 코드를 태우지 않아 같은 코드로 다시 확인할 수 있다', async () => {
        const context = setup({
            proposal: OLD,
            reference: { price: 175, quoteAt: null, referenceClose: 176 },
        });
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'already_met' });
        context.verifyProposal.mockReturnValue(proposal());
        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toMatchObject({ status: 'created' });
    });

    it('코드 확인 흐름에서 시세를 못 읽어도 proposal_stale이고 아무것도 만들지 않는다', async () => {
        const context = setup({ proposal: OLD, reference: null });
        const code = await issueCode(context, GUEST_EMAIL);

        await expect(
            confirmPriceAlertFlow(context.deps, {
                email: GUEST_EMAIL,
                code,
                token: TOKEN,
            })
        ).resolves.toEqual({ status: 'proposal_stale' });
        expect(context.subscribers.rows.size).toBe(0);
    });
});
