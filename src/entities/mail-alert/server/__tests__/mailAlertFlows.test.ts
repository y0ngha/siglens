import type {
    EmailTokenPurpose,
    EmailTokenStore,
    EmailTokenValue,
} from '@/entities/email-token/types';
import { MAIL_ALERT_MAX_TOPICS } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    addMailAlertTopicFlow,
    cancelPriceAlertFlow,
    confirmMailAlertFlow,
    getMailAlertState,
    loadMailAlertManage,
    removeMailAlertTopicFlow,
    requestMailAlertCodeFlow,
    setMailAlertIncludePortfolioFlow,
    unsubscribeMailAlertFlow,
    type MailAlertFlowDeps,
} from '@/entities/mail-alert/server/mailAlertFlows';
import type {
    AddMailAlertTopicOutcome,
    MailAlertOwner,
    MailAlertSubscriberRecord,
    MailAlertTopicRecord,
    PriceAlertRecord,
    UpsertVerifiedMailAlertSubscriberInput,
} from '@/shared/db/types';
import type { AuthUserRecord } from '@/shared/lib/auth/types';

const NOW = new Date('2026-11-23T00:00:00Z');

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

/**
 * 저장소의 소유자 규칙을 그대로 흉내 낸 메모리 구현: 회원은 자기 `user_id` 행만, 비회원은 id가 같고
 * `user_id`가 비어 있는 행만 가리킨다. 흐름이 소유자를 알맞게 고르는지를 규칙째로 본다.
 */
class FakeSubscribers {
    readonly rows = new Map<string, MailAlertSubscriberRecord>();
    readonly topics = new Map<string, MailAlertTopicRecord[]>();
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

    private verifiedOwnerOf(email: string): string | null {
        const account = this.accounts.find(
            candidate => candidate.email === email && candidate.emailVerified
        );
        const alreadyLinked = [...this.rows.values()].some(
            row => row.userId === account?.id
        );
        return account === undefined || alreadyLinked ? null : account.id;
    }

    async upsertVerified(
        input: UpsertVerifiedMailAlertSubscriberInput
    ): Promise<{ id: string; created: boolean }> {
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
        this.counter += 1;
        const id = `sub-${this.counter}`;
        this.rows.set(id, {
            id,
            email: input.email,
            userId: this.verifiedOwnerOf(input.email),
            locale: input.locale,
            includePortfolio: false,
            consentedAt: NOW,
            consentSource: input.consentSource,
            createdAt: NOW,
            updatedAt: NOW,
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

    async listTopics(owner: MailAlertOwner) {
        const row = this.rowOf(owner);
        return row === null ? [] : (this.topics.get(row.id) ?? []);
    }

    async addTopic(
        owner: MailAlertOwner,
        topic: MailAlertTopicRecord,
        max: number
    ): Promise<AddMailAlertTopicOutcome> {
        const row = this.rowOf(owner);
        if (row === null) return 'subscriber_missing';
        const owned = this.topics.get(row.id) ?? [];
        if (owned.some(t => t.kind === topic.kind && t.key === topic.key)) {
            return 'exists';
        }
        if (owned.length >= max) return 'limit_reached';
        this.topics.set(row.id, [...owned, topic]);
        return 'added';
    }

    async removeTopic(owner: MailAlertOwner, topic: MailAlertTopicRecord) {
        const row = this.rowOf(owner);
        const owned = row === null ? [] : (this.topics.get(row.id) ?? []);
        if (row === null || !owned.some(t => t.key === topic.key)) {
            return { deleted: false, subscriberDeleted: false };
        }
        const rest = owned.filter(t => t.key !== topic.key);
        this.topics.set(row.id, rest);
        const subscriberDeleted = rest.length === 0 && !row.includePortfolio;
        if (subscriberDeleted) this.rows.delete(row.id);
        return { deleted: true, subscriberDeleted };
    }

    async setIncludePortfolio(owner: MailAlertOwner, value: boolean) {
        const row = owner.kind === 'member' ? this.rowOf(owner) : null;
        if (row === null) return { found: false, subscriberDeleted: false };
        this.rows.set(row.id, { ...row, includePortfolio: value });
        return { found: true, subscriberDeleted: false };
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

    async deleteByOwner(owner: MailAlertOwner) {
        const row = this.rowOf(owner);
        if (row === null) return false;
        this.rows.delete(row.id);
        return true;
    }
}

/**
 * 가격대 알림 저장소의 소유자 규칙을 흉내 낸 메모리 구현: 알림은 소유자가 가리키는 구독자 행의 것만 보이고
 * 지워진다. 마지막 받을 것이 사라지면(항목 0, 스위치 꺼짐, 살아 있는 알림 0) 구독자도 지운다.
 */
class FakePriceAlerts {
    readonly alerts: PriceAlertRecord[] = [];

    constructor(private readonly subscribers: FakeSubscribers) {}

    add(alert: PriceAlertRecord): void {
        this.alerts.push(alert);
    }

    async listForSubscriber(owner: MailAlertOwner) {
        const row = this.subscribers.rowOf(owner);
        return row === null
            ? []
            : this.alerts.filter(alert => alert.subscriberId === row.id);
    }

    async cancel(owner: MailAlertOwner, id: string) {
        const row = this.subscribers.rowOf(owner);
        const index = this.alerts.findIndex(
            alert => alert.id === id && alert.subscriberId === row?.id
        );
        if (row === null || index < 0) {
            return { deleted: false, subscriberDeleted: false };
        }
        this.alerts.splice(index, 1);
        const hasTopics =
            (this.subscribers.topics.get(row.id) ?? []).length > 0;
        const hasAlerts = this.alerts.some(
            alert => alert.subscriberId === row.id && alert.status === 'active'
        );
        const subscriberDeleted =
            !hasTopics && !hasAlerts && !row.includePortfolio;
        if (subscriberDeleted) this.subscribers.rows.delete(row.id);
        return { deleted: true, subscriberDeleted };
    }
}

const ALERT_ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';

function priceAlert(
    subscriberId: string,
    overrides: Partial<PriceAlertRecord> = {}
): PriceAlertRecord {
    return {
        id: ALERT_ID,
        subscriberId,
        proposalId: 'proposal-1',
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        startsAfterSession: '2026-11-20',
        expiresOn: '2026-12-20',
        status: 'active',
        firedSession: null,
        firedClose: null,
        firedAt: null,
        createdAt: new Date('2026-11-20T03:00:00Z'),
        ...overrides,
    };
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
    readonly deps: MailAlertFlowDeps;
    readonly subscribers: FakeSubscribers;
    readonly priceAlerts: FakePriceAlerts;
    readonly cookie: {
        readonly value: { current: string | null };
        readonly write: ReturnType<typeof vi.fn>;
        readonly clear: ReturnType<typeof vi.fn>;
    };
    readonly sendEmail: ReturnType<typeof vi.fn>;
}

interface SetupOptions {
    readonly account?: AuthUserRecord | null;
    readonly accounts?: readonly AuthUserRecord[];
    readonly cookieId?: string | null;
    readonly launched?: boolean;
    readonly signingReady?: boolean;
    readonly priceAlertsEnabled?: boolean;
    readonly rateLimit?: MailAlertFlowDeps['rateLimit'];
}

function setup(options: SetupOptions = {}): Setup {
    const account = options.account ?? null;
    const subscribers = new FakeSubscribers(
        options.accounts ?? (account === null ? [] : [account])
    );
    const priceAlerts = new FakePriceAlerts(subscribers);
    const cookieValue = { current: options.cookieId ?? null };
    const write = vi.fn(async (id: string) => {
        cookieValue.current = id;
    });
    const clear = vi.fn(async () => {
        cookieValue.current = null;
    });
    const sendEmail = vi.fn().mockResolvedValue(true);
    const deps: MailAlertFlowDeps = {
        launched: options.launched ?? true,
        signingReady: options.signingReady ?? true,
        subscribers,
        priceAlerts,
        priceAlertsEnabled: options.priceAlertsEnabled ?? true,
        users: {
            findByEmail: async email =>
                (options.accounts ?? (account === null ? [] : [account])).find(
                    candidate => candidate.email === email
                ) ?? null,
        } as MailAlertFlowDeps['users'],
        currentUser: async () => account,
        guestCookie: {
            read: async () => cookieValue.current,
            write,
            clear,
        },
        verifyLink: link => link.sig === 'valid-signature',
        rateLimit: options.rateLimit ?? (async () => true),
        resetCounter: async () => {},
        ipHash: async () => 'ip-hash',
        emailTokens: memoryTokens(),
        emailDispatcher: { sendEmail },
        buildCodeMessage: (to, code) => ({
            to,
            subject: 'code',
            html: code,
            text: code,
        }),
        locale: 'ko',
    };
    return {
        deps,
        subscribers,
        priceAlerts,
        cookie: { value: cookieValue, write, clear },
        sendEmail,
    };
}

const SYMBOL = { kind: 'symbol', symbol: 'AAPL' } as const;
const HUB = { kind: 'signal', signalType: 'golden_cross' } as const;
const SYMBOL_ROW = { kind: 'symbol', key: 'AAPL' } as const;

/** 코드 요청 단계를 거쳐 발급된 코드를 메일 본문에서 읽는다. */
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

describe('공개 전·준비 안 됨', () => {
    it.each([
        { launched: false, signingReady: true },
        { launched: true, signingReady: false },
    ])('어느 흐름이든 unavailable이다 (%j)', async options => {
        const { deps } = setup({ account: user(), ...options });

        await expect(getMailAlertState(deps, SYMBOL)).resolves.toEqual({
            status: 'unavailable',
        });
        await expect(
            requestMailAlertCodeFlow(deps, {
                email: 'a@example.com',
                honeypotFilled: false,
            })
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            confirmMailAlertFlow(deps, {
                email: 'a@example.com',
                code: '123456',
                topicInput: SYMBOL,
            })
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            addMailAlertTopicFlow(deps, SYMBOL, { includePortfolio: false })
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            removeMailAlertTopicFlow(deps, SYMBOL, undefined)
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            unsubscribeMailAlertFlow(deps, undefined)
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            setMailAlertIncludePortfolioFlow(deps, true)
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(loadMailAlertManage(deps, undefined)).resolves.toEqual({
            status: 'unavailable',
        });
        await expect(
            cancelPriceAlertFlow(deps, ALERT_ID, undefined)
        ).resolves.toEqual({ status: 'unavailable' });
    });
});

describe('getMailAlertState', () => {
    it('모양이 틀린 항목은 unavailable이다', async () => {
        const { deps } = setup();

        await expect(
            getMailAlertState(deps, { kind: 'symbol', symbol: '!!' })
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(getMailAlertState(deps, null)).resolves.toEqual({
            status: 'unavailable',
        });
    });

    it('아무도 알아보지 못하면 new(고정 주소 없음)다', async () => {
        const { deps } = setup();

        await expect(getMailAlertState(deps, SYMBOL)).resolves.toEqual({
            status: 'new',
            accountEmail: null,
        });
    });

    it('이메일 인증 전 회원은 new이고 계정 주소를 고정해 보여 준다', async () => {
        const { deps } = setup({ account: user({ emailVerified: false }) });

        await expect(getMailAlertState(deps, SYMBOL)).resolves.toEqual({
            status: 'new',
            accountEmail: 'member@example.com',
        });
    });

    it('인증된 회원은 신청 전이면 member이고 가린 주소와 스위치 상태를 준다', async () => {
        const { deps } = setup({ account: user() });

        await expect(getMailAlertState(deps, SYMBOL)).resolves.toEqual({
            status: 'member',
            maskedEmail: 'm***@example.com',
            includePortfolio: false,
        });
    });

    it('인증된 회원이 이미 담았으면 subscribed다', async () => {
        const context = setup({ account: user() });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });

        await expect(getMailAlertState(context.deps, SYMBOL)).resolves.toEqual({
            status: 'subscribed',
            maskedEmail: 'm***@example.com',
        });
        await expect(
            getMailAlertState(context.deps, HUB)
        ).resolves.toMatchObject({
            status: 'member',
        });
    });

    it('쿠키의 구독자는 known이고, 담은 항목이면 subscribed다', async () => {
        const seeded = setup();
        const { id } = await seeded.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        await seeded.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            SYMBOL_ROW,
            MAIL_ALERT_MAX_TOPICS
        );
        const context = {
            ...seeded,
            deps: {
                ...seeded.deps,
                guestCookie: {
                    ...seeded.deps.guestCookie,
                    read: async () => id,
                },
            },
        };

        await expect(getMailAlertState(context.deps, HUB)).resolves.toEqual({
            status: 'known',
            maskedEmail: 'g***@example.com',
        });
        await expect(getMailAlertState(context.deps, SYMBOL)).resolves.toEqual({
            status: 'subscribed',
            maskedEmail: 'g***@example.com',
        });
    });

    it('쿠키가 가리키는 행이 없으면(삭제됐거나 회원에게 연결됐다) 쿠키를 지우고 new다', async () => {
        const { deps, cookie } = setup({ cookieId: 'sub-gone' });

        await expect(getMailAlertState(deps, SYMBOL)).resolves.toEqual({
            status: 'new',
            accountEmail: null,
        });
        expect(cookie.clear).toHaveBeenCalledTimes(1);
        expect(cookie.value.current).toBeNull();
    });
});

describe('requestMailAlertCodeFlow', () => {
    it('봇 함정이 채워졌으면 성공처럼 답하고 코드도 메일도 만들지 않는다', async () => {
        const { deps, sendEmail } = setup();

        await expect(
            requestMailAlertCodeFlow(deps, {
                email: ' a@example.com ',
                honeypotFilled: true,
            })
        ).resolves.toEqual({ status: 'code_sent', email: 'a@example.com' });
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('Redis가 없으면(코드를 저장할 곳이 없다) unavailable이다', async () => {
        const { deps } = setup();

        await expect(
            requestMailAlertCodeFlow(
                { ...deps, emailTokens: null },
                { email: 'a@example.com', honeypotFilled: false }
            )
        ).resolves.toEqual({ status: 'unavailable' });
    });

    it('한도를 넘으면 rate_limited이고 메일을 보내지 않는다', async () => {
        const { deps, sendEmail } = setup({ rateLimit: async () => false });

        await expect(
            requestMailAlertCodeFlow(deps, {
                email: 'a@example.com',
                honeypotFilled: false,
            })
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it('정상 요청은 코드를 보내고 정규화한 주소를 돌려준다', async () => {
        const { deps, sendEmail } = setup();

        await expect(
            requestMailAlertCodeFlow(deps, {
                email: 'A@Example.com',
                honeypotFilled: false,
            })
        ).resolves.toEqual({ status: 'code_sent', email: 'a@example.com' });
        expect(sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'a@example.com' })
        );
    });
});

describe('confirmMailAlertFlow', () => {
    it('코드가 맞으면 구독자와 항목을 만들고 쿠키를 심는다', async () => {
        const context = setup();
        const code = await issueCode(context, 'guest@example.com');

        const result = await confirmMailAlertFlow(context.deps, {
            email: 'guest@example.com',
            code,
            topicInput: HUB,
        });

        expect(result).toEqual({
            status: 'subscribed',
            maskedEmail: 'g***@example.com',
        });
        const [row] = [...context.subscribers.rows.values()];
        expect(row).toMatchObject({
            email: 'guest@example.com',
            userId: null,
            consentSource: 'signal_hub',
        });
        expect(context.subscribers.topics.get(row?.id ?? '')).toEqual([
            { kind: 'signal', key: 'golden_cross' },
        ]);
        expect(context.cookie.write).toHaveBeenCalledWith(row?.id);
    });

    it('항목 종류에 맞춰 동의 화면을 기록한다', async () => {
        const sources = await Promise.all(
            [
                [SYMBOL, 'symbol'],
                [{ kind: 'fear_greed', market: 'us' }, 'fear_greed'],
            ].map(async ([topicInput, expected]) => {
                const context = setup();
                const code = await issueCode(context, 'a@example.com');
                await confirmMailAlertFlow(context.deps, {
                    email: 'a@example.com',
                    code,
                    topicInput,
                });
                return [
                    [...context.subscribers.rows.values()][0]?.consentSource,
                    expected,
                ];
            })
        );

        sources.forEach(([actual, expected]) => expect(actual).toBe(expected));
    });

    it('이미 있는 주소는 같은 행을 쓰고 항목만 더한다', async () => {
        const context = setup();
        const first = await issueCode(context, 'a@example.com');
        await confirmMailAlertFlow(context.deps, {
            email: 'a@example.com',
            code: first,
            topicInput: SYMBOL,
        });
        const second = await issueCode(context, 'a@example.com');

        await confirmMailAlertFlow(context.deps, {
            email: 'a@example.com',
            code: second,
            topicInput: HUB,
        });

        expect(context.subscribers.rows.size).toBe(1);
        const [row] = [...context.subscribers.rows.values()];
        expect(context.subscribers.topics.get(row?.id ?? '')).toHaveLength(2);
    });

    it('틀린 코드와 다른 주소의 코드는 그 상태 그대로 돌려주고 아무것도 만들지 않는다', async () => {
        const context = setup();
        const code = await issueCode(context, 'a@example.com');
        const wrong = code === '000000' ? '000001' : '000000';

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code: wrong,
                topicInput: SYMBOL,
            })
        ).resolves.toEqual({ status: 'wrong_code' });
        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'other@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).resolves.toEqual({ status: 'expired' });
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('모양이 틀린 항목은 invalid다(코드를 소모하지 않는다)', async () => {
        const context = setup();
        const code = await issueCode(context, 'a@example.com');

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: { kind: 'nope' },
            })
        ).resolves.toEqual({ status: 'invalid' });
        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).resolves.toMatchObject({ status: 'subscribed' });
    });

    it('상한에 닿은 구독자는 limit_reached다', async () => {
        const context = setup();
        const seeded = await context.subscribers.upsertVerified({
            email: 'a@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        context.subscribers.topics.set(
            seeded.id,
            Array.from({ length: MAIL_ALERT_MAX_TOPICS }, (_, index) => ({
                kind: 'symbol' as const,
                key: `S${index}`,
            }))
        );
        const code = await issueCode(context, 'a@example.com');

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).resolves.toEqual({ status: 'limit_reached' });
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('주소가 인증된 회원에게 연결돼 있으면 회원 소유자로 담고 쿠키는 심지 않는다', async () => {
        const member = user();
        const context = setup({ accounts: [member] });
        const code = await issueCode(context, member.email);

        const result = await confirmMailAlertFlow(context.deps, {
            email: member.email,
            code,
            topicInput: SYMBOL,
        });

        expect(result).toEqual({
            status: 'subscribed',
            maskedEmail: 'm***@example.com',
        });
        const [row] = [...context.subscribers.rows.values()];
        expect(row?.userId).toBe(member.id);
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('같은 회원을 동시에 연결하다 유니크(23505)에 걸리면 한 번 다시 시도한다', async () => {
        const context = setup();
        const real = context.subscribers.upsertVerified.bind(
            context.subscribers
        );
        const upsert = vi
            .spyOn(context.subscribers, 'upsertVerified')
            .mockRejectedValueOnce(
                Object.assign(new Error('dup'), { cause: { code: '23505' } })
            )
            .mockImplementation(real);
        const code = await issueCode(context, 'a@example.com');

        const result = await confirmMailAlertFlow(context.deps, {
            email: 'a@example.com',
            code,
            topicInput: SYMBOL,
        });

        expect(result).toMatchObject({ status: 'subscribed' });
        expect(upsert).toHaveBeenCalledTimes(2);
    });

    it('두 번 연속 23505면 던진다(액션이 unavailable로 막는다)', async () => {
        const context = setup();
        const duplicate = Object.assign(new Error('dup'), {
            cause: { code: '23505' },
        });
        vi.spyOn(context.subscribers, 'upsertVerified').mockRejectedValue(
            duplicate
        );
        const code = await issueCode(context, 'a@example.com');

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).rejects.toBe(duplicate);
    });

    it('유니크 위반이 아닌 오류는 다시 시도하지 않고 그대로 던진다', async () => {
        const context = setup();
        const boom = new Error('db down');
        const upsert = vi
            .spyOn(context.subscribers, 'upsertVerified')
            .mockRejectedValue(boom);
        const code = await issueCode(context, 'a@example.com');

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).rejects.toBe(boom);
        expect(upsert).toHaveBeenCalledTimes(1);
    });
});

describe('addMailAlertTopicFlow', () => {
    it('모양이 틀린 항목은 invalid다', async () => {
        const { deps } = setup({ account: user() });

        await expect(
            addMailAlertTopicFlow(
                deps,
                { kind: 'signal', signalType: 'x' },
                {
                    includePortfolio: false,
                }
            )
        ).resolves.toEqual({ status: 'invalid' });
    });

    it('IP당 항목 추가 한도를 넘으면 rate_limited다', async () => {
        const { deps } = setup({
            account: user(),
            rateLimit: async rule =>
                !rule.key.startsWith('mail-alert:topic:ip:'),
        });

        await expect(
            addMailAlertTopicFlow(deps, SYMBOL, { includePortfolio: false })
        ).resolves.toEqual({ status: 'rate_limited' });
    });

    it('인증된 회원은 코드 없이 행을 만들고 담는다(행은 그 회원에게 연결된다)', async () => {
        const member = user();
        const context = setup({ account: member });

        const result = await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });

        expect(result).toEqual({
            status: 'subscribed',
            maskedEmail: 'm***@example.com',
        });
        const [row] = [...context.subscribers.rows.values()];
        expect(row).toMatchObject({ email: member.email, userId: member.id });
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('보유·관심종목 함께 받기를 고르면 스위치를 켠다', async () => {
        const context = setup({ account: user() });

        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: true,
        });

        const [row] = [...context.subscribers.rows.values()];
        expect(row?.includePortfolio).toBe(true);
    });

    it('회원도 상한을 넘기면 limit_reached다', async () => {
        const member = user();
        const context = setup({ account: member });
        const { id } = await context.subscribers.upsertVerified({
            email: member.email,
            locale: 'ko',
            consentSource: 'symbol',
        });
        context.subscribers.topics.set(
            id,
            Array.from({ length: MAIL_ALERT_MAX_TOPICS }, (_, index) => ({
                kind: 'symbol' as const,
                key: `S${index}`,
            }))
        );

        await expect(
            addMailAlertTopicFlow(context.deps, SYMBOL, {
                includePortfolio: false,
            })
        ).resolves.toEqual({ status: 'limit_reached' });
    });

    it('같은 브라우저의 쿠키가 있으면 코드 없이 그 구독자에 담는다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        const deps = {
            ...context.deps,
            guestCookie: { ...context.deps.guestCookie, read: async () => id },
        };

        await expect(
            addMailAlertTopicFlow(deps, HUB, { includePortfolio: false })
        ).resolves.toEqual({
            status: 'subscribed',
            maskedEmail: 'g***@example.com',
        });
        expect(context.subscribers.topics.get(id)).toEqual([
            { kind: 'signal', key: 'golden_cross' },
        ]);
    });

    it('쿠키의 구독자가 사라졌으면 쿠키를 지우고 needs_code다', async () => {
        const context = setup({ cookieId: 'sub-gone' });

        await expect(
            addMailAlertTopicFlow(context.deps, SYMBOL, {
                includePortfolio: false,
            })
        ).resolves.toEqual({ status: 'needs_code' });
        expect(context.cookie.clear).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['아무도 알아보지 못하면', null],
        ['이메일 인증 전 회원이면', user({ emailVerified: false })],
    ])('%s needs_code다', async (_name, account) => {
        const { deps } = setup({ account });

        await expect(
            addMailAlertTopicFlow(deps, SYMBOL, { includePortfolio: false })
        ).resolves.toEqual({ status: 'needs_code' });
    });
});

describe('removeMailAlertTopicFlow', () => {
    it('항목을 빼고, 마지막이면 구독자 삭제로 알리며 쿠키를 지운다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            SYMBOL_ROW,
            MAIL_ALERT_MAX_TOPICS
        );
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            { kind: 'signal', key: 'golden_cross' },
            MAIL_ALERT_MAX_TOPICS
        );
        const deps = {
            ...context.deps,
            guestCookie: { ...context.deps.guestCookie, read: async () => id },
        };

        await expect(
            removeMailAlertTopicFlow(deps, SYMBOL, undefined)
        ).resolves.toEqual({ status: 'ok' });
        await expect(
            removeMailAlertTopicFlow(deps, HUB, undefined)
        ).resolves.toEqual({ status: 'subscriber_removed' });
        expect(context.cookie.clear).toHaveBeenCalledTimes(1);
    });

    it('받지 않는 항목이나 소유자를 알 수 없는 호출은 not_found다', async () => {
        const member = setup({ account: user() });

        await expect(
            removeMailAlertTopicFlow(member.deps, SYMBOL, undefined)
        ).resolves.toEqual({ status: 'not_found' });
        await expect(
            removeMailAlertTopicFlow(setup().deps, SYMBOL, undefined)
        ).resolves.toEqual({ status: 'not_found' });
    });

    it('서명이 맞는 설정 링크는 소유자를 정하고, 틀린 서명은 정하지 못한다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            SYMBOL_ROW,
            MAIL_ALERT_MAX_TOPICS
        );

        await expect(
            removeMailAlertTopicFlow(context.deps, SYMBOL, {
                s: id,
                sig: 'forged',
            })
        ).resolves.toEqual({ status: 'not_found' });
        await expect(
            removeMailAlertTopicFlow(context.deps, SYMBOL, {
                s: id,
                sig: 'valid-signature',
            })
        ).resolves.toEqual({ status: 'subscriber_removed' });
    });

    it('모양이 틀린 항목은 invalid다', async () => {
        await expect(
            removeMailAlertTopicFlow(setup().deps, { kind: 'x' }, undefined)
        ).resolves.toEqual({ status: 'invalid' });
    });
});

describe('unsubscribeMailAlertFlow', () => {
    it('회원은 자기 행을 지운다(비회원 때 만든 같은 주소의 행까지 연결해서)', async () => {
        const member = user();
        const context = setup({ account: member });
        await context.subscribers.upsertVerified({
            email: member.email,
            locale: 'ko',
            consentSource: 'symbol',
        });
        context.subscribers.rows.forEach((row, id) =>
            context.subscribers.rows.set(id, { ...row, userId: null })
        );

        await expect(
            unsubscribeMailAlertFlow(context.deps, undefined)
        ).resolves.toEqual({ status: 'subscriber_removed' });
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('쿠키의 구독자를 지우고 쿠키를 비운다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        const deps = {
            ...context.deps,
            guestCookie: { ...context.deps.guestCookie, read: async () => id },
        };

        await expect(
            unsubscribeMailAlertFlow(deps, undefined)
        ).resolves.toEqual({
            status: 'subscriber_removed',
        });
        expect(context.cookie.clear).toHaveBeenCalledTimes(1);
    });

    it('소유자를 알 수 없으면 not_found다', async () => {
        await expect(
            unsubscribeMailAlertFlow(setup().deps, undefined)
        ).resolves.toEqual({ status: 'not_found' });
    });
});

describe('setMailAlertIncludePortfolioFlow', () => {
    it('회원만 바꿀 수 있고 행이 없으면 not_found다', async () => {
        const member = user();
        const context = setup({ account: member });

        await expect(
            setMailAlertIncludePortfolioFlow(context.deps, true)
        ).resolves.toEqual({ status: 'not_found' });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });
        await expect(
            setMailAlertIncludePortfolioFlow(context.deps, true)
        ).resolves.toEqual({ status: 'ok' });
    });

    it('비회원(쿠키)은 저장소를 부르지 않고 not_found다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        const spy = vi.spyOn(context.subscribers, 'setIncludePortfolio');
        const deps = {
            ...context.deps,
            guestCookie: { ...context.deps.guestCookie, read: async () => id },
        };

        await expect(
            setMailAlertIncludePortfolioFlow(deps, true)
        ).resolves.toEqual({ status: 'not_found' });
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('서명 링크가 세션보다 앞선다', () => {
    /** 회원 한 명(주소 m@)과, 따로 신청한 다른 비회원 구독자(g@). */
    async function twoSubscribers() {
        const member = user();
        const context = setup({ account: member });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });
        const guest = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: guest.id },
            SYMBOL_ROW,
            MAIL_ALERT_MAX_TOPICS
        );
        const [own] = [...context.subscribers.rows.values()].filter(
            row => row.userId === member.id
        );
        return { context, member, guestId: guest.id, ownId: own?.id ?? '' };
    }

    it('세션 회원이 다른 구독자의 링크로 열면 링크가 가리키는 구독자에게만 일한다', async () => {
        const { context, guestId, ownId } = await twoSubscribers();

        await expect(
            removeMailAlertTopicFlow(context.deps, SYMBOL, {
                s: guestId,
                sig: 'valid-signature',
            })
        ).resolves.toEqual({ status: 'subscriber_removed' });

        expect(context.subscribers.rows.has(guestId)).toBe(false);
        expect(context.subscribers.rows.has(ownId)).toBe(true);
        expect(context.subscribers.topics.get(ownId)).toEqual([SYMBOL_ROW]);
    });

    it('링크로 전체 해지해도 링크의 구독자만 지워지고 회원 본인의 구독은 남는다', async () => {
        const { context, guestId, ownId } = await twoSubscribers();

        await unsubscribeMailAlertFlow(context.deps, {
            s: guestId,
            sig: 'valid-signature',
        });

        expect(context.subscribers.rows.has(guestId)).toBe(false);
        expect(context.subscribers.rows.has(ownId)).toBe(true);
    });

    it('링크가 있는데 서명이 틀리면 거절한다(세션 회원의 구독으로 대신 움직이지 않는다)', async () => {
        const { context, guestId, ownId } = await twoSubscribers();
        const forged = { s: guestId, sig: 'forged' };

        await expect(
            removeMailAlertTopicFlow(context.deps, SYMBOL, forged)
        ).resolves.toEqual({ status: 'not_found' });
        await expect(
            unsubscribeMailAlertFlow(context.deps, forged)
        ).resolves.toEqual({ status: 'not_found' });

        expect(context.subscribers.rows.has(ownId)).toBe(true);
        expect(context.subscribers.rows.has(guestId)).toBe(true);
        expect(context.subscribers.topics.get(ownId)).toEqual([SYMBOL_ROW]);
    });

    it('링크가 자기 행을 가리키면 세션 없이도(회원 행이어도) 지울 수 있다', async () => {
        const { context, ownId } = await twoSubscribers();
        const anonymous = { ...context.deps, currentUser: async () => null };

        await expect(
            unsubscribeMailAlertFlow(anonymous, {
                s: ownId,
                sig: 'valid-signature',
            })
        ).resolves.toEqual({ status: 'subscriber_removed' });
        expect(context.subscribers.rows.has(ownId)).toBe(false);
    });
});

describe('로그인한 회원이 자기 주소로 코드를 확인하면 행이 계정에 연결된다', () => {
    it('이메일 인증 전 계정이어도 같은 주소면 연결하고 쿠키는 심지 않는다', async () => {
        const member = user({ emailVerified: false });
        const context = setup({ account: member, accounts: [member] });
        const code = await issueCode(context, member.email);

        const result = await confirmMailAlertFlow(context.deps, {
            email: member.email,
            code,
            topicInput: SYMBOL,
        });

        expect(result).toMatchObject({ status: 'subscribed' });
        const [row] = [...context.subscribers.rows.values()];
        expect(row?.userId).toBe(member.id);
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('다른 주소를 확인했다면 연결하지 않고 비회원 행으로 둔다', async () => {
        const member = user({ emailVerified: false });
        const context = setup({ account: member, accounts: [member] });
        const code = await issueCode(context, 'other@example.com');

        await confirmMailAlertFlow(context.deps, {
            email: 'other@example.com',
            code,
            topicInput: SYMBOL,
        });

        const [row] = [...context.subscribers.rows.values()];
        expect(row?.userId).toBeNull();
        expect(context.cookie.write).toHaveBeenCalledWith(row?.id);
    });
});

describe('이메일 인증 전 회원이 코드 확인으로 연결한 행', () => {
    async function linkedUnverified() {
        const member = user({ emailVerified: false });
        const context = setup({ account: member, accounts: [member] });
        const code = await issueCode(context, member.email);
        await confirmMailAlertFlow(context.deps, {
            email: member.email,
            code,
            topicInput: SYMBOL,
        });
        return { context, member };
    }

    it('연결된 행을 보고 항목을 뺄 수 있다(소유자 없는 인증 전 회원으로 남지 않는다)', async () => {
        const { context } = await linkedUnverified();

        await expect(getMailAlertState(context.deps, SYMBOL)).resolves.toEqual({
            status: 'subscribed',
            maskedEmail: 'm***@example.com',
        });
        await expect(
            loadMailAlertManage(context.deps, undefined)
        ).resolves.toMatchObject({
            status: 'ready',
            view: { topics: [SYMBOL] },
        });
        await expect(
            removeMailAlertTopicFlow(context.deps, SYMBOL, undefined)
        ).resolves.toEqual({ status: 'subscriber_removed' });
        expect(context.subscribers.rows.size).toBe(0);
    });

    it('연결된 행이 없으면 그대로 new(고정 주소)이고 설정 화면은 알아보지 못한다', async () => {
        const context = setup({ account: user({ emailVerified: false }) });

        await expect(getMailAlertState(context.deps, SYMBOL)).resolves.toEqual({
            status: 'new',
            accountEmail: 'member@example.com',
        });
        await expect(
            loadMailAlertManage(context.deps, undefined)
        ).resolves.toEqual({ status: 'unidentified' });
    });
});

describe('코드 확인 한도', () => {
    it('IP당 확인 시도 한도를 넘으면 rate_limited이고 아무것도 만들지 않는다', async () => {
        const context = setup({
            rateLimit: async rule =>
                !rule.key.startsWith('mail-alert:verify:ip:'),
        });
        const code = await issueCode(context, 'a@example.com');

        await expect(
            confirmMailAlertFlow(context.deps, {
                email: 'a@example.com',
                code,
                topicInput: SYMBOL,
            })
        ).resolves.toEqual({ status: 'rate_limited' });
        expect(context.subscribers.rows.size).toBe(0);
    });
});

describe('loadMailAlertManage', () => {
    it('아무도 알아보지 못하면 unidentified다', async () => {
        await expect(
            loadMailAlertManage(setup().deps, undefined)
        ).resolves.toEqual({ status: 'unidentified' });
        await expect(
            loadMailAlertManage(
                setup({ account: user({ emailVerified: false }) }).deps,
                undefined
            )
        ).resolves.toEqual({ status: 'unidentified' });
    });

    it('항목 없는 회원은 empty다', async () => {
        await expect(
            loadMailAlertManage(setup({ account: user() }).deps, undefined)
        ).resolves.toEqual({ status: 'empty' });
    });

    it('회원은 항목과 스위치 값을 본다', async () => {
        const context = setup({ account: user() });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: true,
        });
        await addMailAlertTopicFlow(context.deps, HUB, {
            includePortfolio: false,
        });

        await expect(
            loadMailAlertManage(context.deps, undefined)
        ).resolves.toEqual({
            status: 'ready',
            view: {
                maskedEmail: 'm***@example.com',
                topics: [SYMBOL, HUB],
                includePortfolio: true,
                priceAlerts: [],
                firedPriceAlerts: [],
            },
        });
    });

    it('서명 링크의 비회원은 항목을 보고 스위치는 없다(null)', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'symbol',
        });
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            { kind: 'fear_greed', key: 'kr' },
            MAIL_ALERT_MAX_TOPICS
        );
        await context.subscribers.addTopic(
            { kind: 'guest', subscriberId: id },
            { kind: 'symbol', key: 'retired-kind' },
            MAIL_ALERT_MAX_TOPICS
        );

        await expect(
            loadMailAlertManage(context.deps, {
                s: id,
                sig: 'valid-signature',
            })
        ).resolves.toEqual({
            status: 'ready',
            view: {
                maskedEmail: 'g***@example.com',
                topics: [{ kind: 'fear_greed', market: 'kr' }],
                includePortfolio: null,
                priceAlerts: [],
                firedPriceAlerts: [],
            },
        });
    });

    it('틀린 서명은 알아보지 못한다(세션 회원이어도 그 회원의 구독으로 대신 보여 주지 않는다)', async () => {
        const context = setup({ account: user() });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });

        await expect(
            loadMailAlertManage(context.deps, { s: 'sub-1', sig: 'forged' })
        ).resolves.toEqual({ status: 'unidentified' });
    });

    it('낡은 쿠키(가리키는 행이 없다)는 unidentified이고 렌더 중에는 쿠키를 건드리지 않는다', async () => {
        const context = setup({ cookieId: 'sub-gone' });
        const readOnly = {
            ...context.deps,
            guestCookie: { read: context.deps.guestCookie.read },
        };

        await expect(loadMailAlertManage(readOnly, undefined)).resolves.toEqual(
            {
                status: 'unidentified',
            }
        );
        expect(context.cookie.clear).not.toHaveBeenCalled();
        expect(context.cookie.write).not.toHaveBeenCalled();
    });

    it('회원에게 연결된 행도 서명 링크로 항목을 보되 스위치 값은 보이지 않는다(null)', async () => {
        const member = user();
        const context = setup({ account: member });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: true,
        });
        const [row] = [...context.subscribers.rows.values()];
        const anonymous = { ...context.deps, currentUser: async () => null };

        await expect(
            loadMailAlertManage(anonymous, {
                s: row?.id ?? '',
                sig: 'valid-signature',
            })
        ).resolves.toEqual({
            status: 'ready',
            view: {
                maskedEmail: 'm***@example.com',
                topics: [SYMBOL],
                includePortfolio: null,
                priceAlerts: [],
                firedPriceAlerts: [],
            },
        });
    });

    describe('가격대 알림', () => {
        const FIRED_AT = new Date('2026-11-22T22:05:00Z');

        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-11-23T01:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        async function memberWithAlerts(
            ...alerts: Array<(subscriberId: string) => PriceAlertRecord>
        ) {
            const context = setup({ account: user() });
            await addMailAlertTopicFlow(context.deps, SYMBOL, {
                includePortfolio: false,
            });
            const [row] = [...context.subscribers.rows.values()];
            alerts.forEach(make =>
                context.priceAlerts.add(make(row?.id ?? ''))
            );
            return context;
        }

        it('살아 있는 알림과 알린 알림을 나눠 담고, 알린 알림은 최근에 알린 순이다', async () => {
            const context = await memberWithAlerts(
                id => priceAlert(id, { id: 'active-1' }),
                id =>
                    priceAlert(id, {
                        id: 'fired-old',
                        status: 'fired',
                        firedSession: '2026-11-20',
                        firedClose: 170,
                        firedAt: new Date('2026-11-21T22:05:00Z'),
                    }),
                id =>
                    priceAlert(id, {
                        id: 'fired-new',
                        status: 'fired',
                        firedSession: '2026-11-22',
                        firedClose: 171,
                        firedAt: FIRED_AT,
                    })
            );

            const load = await loadMailAlertManage(context.deps, undefined);

            expect(load.status).toBe('ready');
            if (load.status !== 'ready') return;
            expect(load.view.priceAlerts.map(alert => alert.id)).toEqual([
                'active-1',
            ]);
            expect(load.view.firedPriceAlerts.map(alert => alert.id)).toEqual([
                'fired-new',
                'fired-old',
            ]);
        });

        it('만료 세션을 판정하는 실행이 지났지만 아직 정리되지 않은 진행 중 알림은 보이지 않고, 마지막 마감 세션이 만료 세션인 알림은 보인다', async () => {
            const context = await memberWithAlerts(
                id =>
                    priceAlert(id, { id: 'expired', expiresOn: '2026-11-19' }),
                id => priceAlert(id, { id: 'on-day', expiresOn: '2026-11-20' })
            );

            const load = await loadMailAlertManage(context.deps, undefined);

            expect(
                load.status === 'ready'
                    ? load.view.priceAlerts.map(alert => alert.id)
                    : null
            ).toEqual(['on-day']);
        });

        it('화면 모양에는 제안 id와 구독자 id를 싣지 않는다', async () => {
            const context = await memberWithAlerts(id => priceAlert(id));

            const load = await loadMailAlertManage(context.deps, undefined);

            const [alert] =
                load.status === 'ready' ? load.view.priceAlerts : [];
            expect(alert).toBeDefined();
            expect(Object.keys(alert ?? {})).not.toContain('proposalId');
            expect(Object.keys(alert ?? {})).not.toContain('subscriberId');
        });

        it('공개 전에는 저장소를 읽지 않고 목록이 비어 있다', async () => {
            const context = await memberWithAlerts(id => priceAlert(id));
            const spy = vi.spyOn(context.priceAlerts, 'listForSubscriber');
            const closed = { ...context.deps, priceAlertsEnabled: false };

            const load = await loadMailAlertManage(closed, undefined);

            expect(spy).not.toHaveBeenCalled();
            expect(
                load.status === 'ready'
                    ? [load.view.priceAlerts, load.view.firedPriceAlerts]
                    : null
            ).toEqual([[], []]);
        });

        it('서명 링크의 비회원은 그 링크가 가리키는 구독자의 알림만 본다', async () => {
            const context = setup();
            const mine = await context.subscribers.upsertVerified({
                email: 'guest@example.com',
                locale: 'ko',
                consentSource: 'agent_chat',
            });
            const other = await context.subscribers.upsertVerified({
                email: 'other@example.com',
                locale: 'ko',
                consentSource: 'agent_chat',
            });
            context.priceAlerts.add(priceAlert(mine.id, { id: 'mine' }));
            context.priceAlerts.add(priceAlert(other.id, { id: 'theirs' }));

            const load = await loadMailAlertManage(context.deps, {
                s: mine.id,
                sig: 'valid-signature',
            });

            expect(
                load.status === 'ready'
                    ? load.view.priceAlerts.map(alert => alert.id)
                    : null
            ).toEqual(['mine']);
        });
    });
});

describe('cancelPriceAlertFlow', () => {
    async function memberContext() {
        const context = setup({ account: user() });
        await addMailAlertTopicFlow(context.deps, SYMBOL, {
            includePortfolio: false,
        });
        const [row] = [...context.subscribers.rows.values()];
        context.priceAlerts.add(priceAlert(row?.id ?? ''));
        return { context, subscriberId: row?.id ?? '' };
    }

    it('공개 전이거나 알림이 닫혀 있으면 unavailable이다', async () => {
        const { context } = await memberContext();

        await expect(
            cancelPriceAlertFlow(
                { ...context.deps, priceAlertsEnabled: false },
                ALERT_ID,
                undefined
            )
        ).resolves.toEqual({ status: 'unavailable' });
        await expect(
            cancelPriceAlertFlow(
                { ...context.deps, launched: false },
                ALERT_ID,
                undefined
            )
        ).resolves.toEqual({ status: 'unavailable' });
        expect(context.priceAlerts.alerts).toHaveLength(1);
    });

    it.each([undefined, null, 42, {}, 'not-a-uuid', ''])(
        '알림 id가 UUID 문자열이 아니면(%j) 저장소까지 가지 않고 invalid다',
        async value => {
            const { context } = await memberContext();
            const spy = vi.spyOn(context.priceAlerts, 'cancel');

            await expect(
                cancelPriceAlertFlow(context.deps, value, undefined)
            ).resolves.toEqual({ status: 'invalid' });

            expect(spy).not.toHaveBeenCalled();
        }
    );

    it('세션 회원은 자기 알림을 지우고, 항목이 남아 있으면 구독자는 그대로다', async () => {
        const { context } = await memberContext();

        await expect(
            cancelPriceAlertFlow(context.deps, ALERT_ID, undefined)
        ).resolves.toEqual({ status: 'ok' });

        expect(context.priceAlerts.alerts).toEqual([]);
        expect(context.subscribers.rows.size).toBe(1);
    });

    it('쿠키의 비회원도 자기 알림을 지우고, 받을 것이 없어지면 구독자 삭제로 알리며 쿠키를 지운다', async () => {
        const context = setup();
        const { id } = await context.subscribers.upsertVerified({
            email: 'guest@example.com',
            locale: 'ko',
            consentSource: 'agent_chat',
        });
        context.priceAlerts.add(priceAlert(id));
        context.cookie.value.current = id;

        await expect(
            cancelPriceAlertFlow(context.deps, ALERT_ID, undefined)
        ).resolves.toEqual({ status: 'subscriber_removed' });

        expect(context.subscribers.rows.has(id)).toBe(false);
        expect(context.cookie.clear).toHaveBeenCalled();
    });

    it('서명이 맞는 링크는 그 구독자의 알림을 지운다', async () => {
        const { context, subscriberId } = await memberContext();
        const anonymous = { ...context.deps, currentUser: async () => null };

        await expect(
            cancelPriceAlertFlow(anonymous, ALERT_ID, {
                s: subscriberId,
                sig: 'valid-signature',
            })
        ).resolves.toEqual({ status: 'ok' });

        expect(context.priceAlerts.alerts).toEqual([]);
    });

    it('링크가 있는데 서명이 틀리면 거절한다(세션 회원의 알림으로 대신 움직이지 않는다)', async () => {
        const { context, subscriberId } = await memberContext();

        await expect(
            cancelPriceAlertFlow(context.deps, ALERT_ID, {
                s: subscriberId,
                sig: 'forged',
            })
        ).resolves.toEqual({ status: 'not_found' });

        expect(context.priceAlerts.alerts).toHaveLength(1);
    });

    it('알아볼 수 없는 호출은 not_found이고 아무것도 지우지 않는다', async () => {
        const { context } = await memberContext();
        const anonymous = { ...context.deps, currentUser: async () => null };

        await expect(
            cancelPriceAlertFlow(anonymous, ALERT_ID, undefined)
        ).resolves.toEqual({ status: 'not_found' });

        expect(context.priceAlerts.alerts).toHaveLength(1);
    });

    it('다른 구독자의 알림 id는 not_found이고 그 알림은 남는다(소유자는 저장소 문장이 정한다)', async () => {
        const { context } = await memberContext();
        const other = await context.subscribers.upsertVerified({
            email: 'other@example.com',
            locale: 'ko',
            consentSource: 'agent_chat',
        });
        const otherAlertId = '11111111-2222-4333-8444-555555555555';
        context.priceAlerts.add(priceAlert(other.id, { id: otherAlertId }));

        await expect(
            cancelPriceAlertFlow(context.deps, otherAlertId, undefined)
        ).resolves.toEqual({ status: 'not_found' });

        expect(context.priceAlerts.alerts.map(alert => alert.id)).toContain(
            otherAlertId
        );
    });
});
