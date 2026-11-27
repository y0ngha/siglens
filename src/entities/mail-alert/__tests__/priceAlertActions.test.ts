const launched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/priceAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/priceAlertConstants')
        >()),
        isPriceAlertLaunched: () => launched.value,
    })
);
vi.mock('@/entities/mail-alert/server/createPriceAlertDeps', () => ({
    createPriceAlertDeps: vi.fn(),
}));
vi.mock('@/entities/mail-alert/server/priceAlertFlows', () => ({
    getPriceAlertProposalState: vi.fn(),
    createPriceAlertFlow: vi.fn(),
    confirmPriceAlertFlow: vi.fn(),
}));

import { confirmPriceAlertAction } from '@/entities/mail-alert/actions/confirmPriceAlertAction';
import { createPriceAlertAction } from '@/entities/mail-alert/actions/createPriceAlertAction';
import { getPriceAlertProposalStateAction } from '@/entities/mail-alert/actions/getPriceAlertProposalStateAction';
import { createPriceAlertDeps } from '@/entities/mail-alert/server/createPriceAlertDeps';
import * as flows from '@/entities/mail-alert/server/priceAlertFlows';
import {
    expectLogWithoutPlantedSecrets,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';

const DEPS = { marker: 'deps' } as unknown as Awaited<
    ReturnType<typeof createPriceAlertDeps>
>;
const TOKEN = 'signed-token';

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    Object.entries(fields).forEach(([name, value]) => data.set(name, value));
    return data;
}

const ACTIONS = [
    {
        name: 'getPriceAlertProposalStateAction',
        run: () => getPriceAlertProposalStateAction(TOKEN),
        flow: flows.getPriceAlertProposalState,
    },
    {
        name: 'createPriceAlertAction',
        run: () => createPriceAlertAction(TOKEN),
        flow: flows.createPriceAlertFlow,
    },
    {
        name: 'confirmPriceAlertAction',
        run: () =>
            confirmPriceAlertAction(
                { status: 'idle' },
                form({ email: 'a@example.com', code: '123456', token: TOKEN })
            ),
        flow: flows.confirmPriceAlertFlow,
    },
] as const;

beforeEach(() => {
    vi.clearAllMocks();
    launched.value = true;
    vi.mocked(createPriceAlertDeps).mockResolvedValue(DEPS);
});

describe.each(ACTIONS)('$name', ({ run, flow, name }) => {
    const fallback = { status: 'unavailable' };

    it('공개 전이면 의존성도 만들지 않고 unavailable이다', async () => {
        launched.value = false;

        await expect(run()).resolves.toEqual(fallback);
        expect(createPriceAlertDeps).not.toHaveBeenCalled();
        expect(flow).not.toHaveBeenCalled();
    });

    it('테이블이 없는 환경(42P01)은 조용히 unavailable이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(flow).mockRejectedValue({ cause: { code: '42P01' } });

        await expect(run()).resolves.toEqual(fallback);
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('그 밖의 오류는 질의 값을 가려 한 줄 남기고 unavailable로 답한다(SA-26)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(flow).mockRejectedValue(plantedDbError());

        await expect(run()).resolves.toEqual(fallback);
        expectLogWithoutPlantedSecrets(error);
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining(`[${name}]`),
            expect.anything()
        );
        error.mockRestore();
    });

    it('의존성을 만들다 던져도 던지지 않는다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(createPriceAlertDeps).mockRejectedValue(new Error('db'));

        await expect(run()).resolves.toEqual(fallback);
        error.mockRestore();
    });
});

describe('입력 전달', () => {
    it('상태 읽기와 만들기는 토큰을 그대로 흐름에 넘긴다(검증은 흐름이 한다)', async () => {
        vi.mocked(flows.getPriceAlertProposalState).mockResolvedValue({
            status: 'invalid',
        });
        vi.mocked(flows.createPriceAlertFlow).mockResolvedValue({
            status: 'needs_code',
        });

        await expect(getPriceAlertProposalStateAction(TOKEN)).resolves.toEqual({
            status: 'invalid',
        });
        await expect(createPriceAlertAction({ forged: true })).resolves.toEqual(
            {
                status: 'needs_code',
            }
        );

        expect(flows.getPriceAlertProposalState).toHaveBeenCalledWith(
            DEPS,
            TOKEN
        );
        expect(flows.createPriceAlertFlow).toHaveBeenCalledWith(DEPS, {
            forged: true,
        });
    });

    it('코드 확인은 폼의 주소·코드·토큰만 읽는다(문자열이 아닌 값은 빈 문자열)', async () => {
        vi.mocked(flows.confirmPriceAlertFlow).mockResolvedValue({
            status: 'wrong_code',
        });
        const data = form({
            email: 'a@example.com',
            code: '123456',
            token: TOKEN,
        });
        data.set('extra', 'ignored');

        await confirmPriceAlertAction({ status: 'idle' }, data);
        await confirmPriceAlertAction({ status: 'idle' }, new FormData());

        expect(flows.confirmPriceAlertFlow).toHaveBeenCalledWith(DEPS, {
            email: 'a@example.com',
            code: '123456',
            token: TOKEN,
        });
        expect(flows.confirmPriceAlertFlow).toHaveBeenCalledWith(DEPS, {
            email: '',
            code: '',
            token: '',
        });
    });
});
