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
vi.mock('@/entities/mail-alert/server/createMailAlertDeps', () => ({
    createMailAlertDeps: vi.fn(),
}));
vi.mock('@/entities/mail-alert/server/mailAlertFlows', () => ({
    loadMailAlertManage: vi.fn(),
}));

import { createMailAlertDeps } from '@/entities/mail-alert/server/createMailAlertDeps';
import { loadMailAlertManageView } from '@/entities/mail-alert/server/loadMailAlertManageView';
import { loadMailAlertManage } from '@/entities/mail-alert/server/mailAlertFlows';

const COOKIE = { read: vi.fn(), write: vi.fn(), clear: vi.fn() };
const DEPS = { marker: 'deps', guestCookie: COOKIE } as unknown as Awaited<
    ReturnType<typeof createMailAlertDeps>
>;

beforeEach(() => {
    vi.clearAllMocks();
    launched.value = true;
    vi.mocked(createMailAlertDeps).mockResolvedValue(DEPS);
});

describe('loadMailAlertManageView', () => {
    it('공개 전이면 아무것도 읽지 않고 unavailable이다', async () => {
        launched.value = false;

        await expect(loadMailAlertManageView(undefined)).resolves.toEqual({
            status: 'unavailable',
        });
        expect(createMailAlertDeps).not.toHaveBeenCalled();
    });

    it('설정 링크를 그대로 흐름에 넘기고 결과를 돌려준다', async () => {
        vi.mocked(loadMailAlertManage).mockResolvedValue({ status: 'empty' });

        await expect(
            loadMailAlertManageView({ s: 'id', sig: 'x' })
        ).resolves.toEqual({ status: 'empty' });
        // 렌더 중에는 쿠키를 쓰지 않는다 — 흐름은 읽기만 가진 포트를 받는다.
        expect(loadMailAlertManage).toHaveBeenCalledWith(
            expect.objectContaining({
                marker: 'deps',
                guestCookie: { read: COOKIE.read },
            }),
            { s: 'id', sig: 'x' }
        );
        const passed = vi
            .mocked(loadMailAlertManage)
            .mock.calls.find(call => call[1]?.s === 'id')?.[0];
        expect(Object.keys(passed?.guestCookie ?? {})).toEqual(['read']);
    });

    it('테이블이 없는 환경(42P01)은 조용히 unavailable이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(loadMailAlertManage).mockRejectedValue({
            cause: { code: '42P01' },
        });

        await expect(loadMailAlertManageView(undefined)).resolves.toEqual({
            status: 'unavailable',
        });
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('그 밖의 오류는 unavailable로 답하고 한 줄 남긴다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(loadMailAlertManage).mockRejectedValue(new Error('db'));

        await expect(loadMailAlertManageView(undefined)).resolves.toEqual({
            status: 'unavailable',
        });
        expect(error).toHaveBeenCalledWith(
            '[loadMailAlertManageView] failed:',
            expect.anything()
        );
        error.mockRestore();
    });
});
