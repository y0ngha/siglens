/**
 * 한도는 키가 아니라 회원 단위다. 키를 폐기하고 새로 발급하거나(또는 키 5개를 돌려써도)
 * 같은 회원의 카운터는 초기화되지 않는다. 한도 로직(실물)을 상태 있는 Redis fake 위에서 돌린다.
 */
const { mockAuth, mockExecute, redisState } = vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockExecute: vi.fn(),
    redisState: { counts: new Map<string, number>() },
}));
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    authenticateApiKey: mockAuth,
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => ({
        multi: () => {
            const ops: Array<() => number> = [];
            const pipe = {
                incr: (key: string) => {
                    ops.push(() => {
                        const next = (redisState.counts.get(key) ?? 0) + 1;
                        redisState.counts.set(key, next);
                        return next;
                    });
                    return pipe;
                },
                expire: () => {
                    ops.push(() => 1);
                    return pipe;
                },
                exec: async () => ops.map(run => run()),
            };
            return pipe;
        },
    }),
}));
vi.mock('@/app/api/v1/executePublicTool', () => ({
    executePublicTool: mockExecute,
    resolveApiLocale: () => 'en',
}));
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    availableToolNames: () => new Set(['get_quote']),
    createToolExecutor: vi.fn(),
}));

import { POST } from '@/app/api/v1/tools/[name]/route';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const principalOf = (userId: string, keyId: string) => ({
    keyId,
    keyName: keyId,
    keyPrefix: 'slk_abcdef',
    userId,
    tier: 'member' as const,
});

function call(): Promise<Response> {
    return POST(
        new Request('https://siglens.io/api/v1/tools/get_quote', {
            method: 'POST',
            headers: { authorization: 'Bearer slk_x' },
            body: JSON.stringify({ symbols: ['AAPL'] }),
        }),
        { params: Promise.resolve({ name: 'get_quote' }) }
    );
}

async function exhaustMinute(): Promise<void> {
    for (let i = 0; i < PUBLIC_API_RATE_LIMITS.data.perMinute; i += 1) {
        expect((await call()).status).toBe(200);
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    redisState.counts.clear();
    mockExecute.mockResolvedValue({ ok: true, data: {}, truncated: false });
});

describe('한도는 회원 단위', () => {
    it('키를 폐기하고 새로 발급해도 분 카운터가 초기화되지 않는다', async () => {
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-old'),
        });
        await exhaustMinute();
        expect((await call()).status).toBe(429);

        // 같은 회원이 폐기 후 새 키(keyId가 다르다)로 다시 시도한다.
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-new'),
        });
        const retry = await call();
        expect(retry.status).toBe(429);
        expect(retry.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('일 카운터도 키가 바뀌어도 이어진다', async () => {
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-old'),
        });
        await call();
        const dayKeys = [...redisState.counts.keys()].filter(k =>
            k.includes(':d:')
        );
        expect(dayKeys).toHaveLength(1);
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-new'),
        });
        await call();
        expect(redisState.counts.get(dayKeys[0])).toBe(2);
        expect(
            [...redisState.counts.keys()].filter(k => k.includes(':d:'))
        ).toHaveLength(1);
    });

    it('카운터 키에는 회원 id가 들어가고 키 id는 들어가지 않는다', async () => {
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-secret-id'),
        });
        await call();
        for (const key of redisState.counts.keys()) {
            expect(key).toContain(USER);
            expect(key).not.toContain('key-secret-id');
        }
    });

    it('다른 회원의 카운터는 영향을 받지 않는다', async () => {
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(USER, 'key-a'),
        });
        await exhaustMinute();
        mockAuth.mockResolvedValue({
            status: 'ok',
            principal: principalOf(OTHER_USER, 'key-b'),
        });
        expect((await call()).status).toBe(200);
    });
});
