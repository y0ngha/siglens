import {
    expectLogWithoutPlantedSecrets,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';

const launched = vi.hoisted(() => ({ value: true }));
const priceLaunched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/priceAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/priceAlertConstants')
        >()),
        isPriceAlertLaunched: () => priceLaunched.value,
    })
);
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
    getMailAlertState: vi.fn(),
    requestMailAlertCodeFlow: vi.fn(),
    confirmMailAlertFlow: vi.fn(),
    addMailAlertTopicFlow: vi.fn(),
    removeMailAlertTopicFlow: vi.fn(),
    unsubscribeMailAlertFlow: vi.fn(),
    setMailAlertIncludePortfolioFlow: vi.fn(),
    cancelPriceAlertFlow: vi.fn(),
}));

import { addMailAlertTopicAction } from '@/entities/mail-alert/actions/addMailAlertTopicAction';
import { cancelPriceAlertAction } from '@/entities/mail-alert/actions/cancelPriceAlertAction';
import { confirmMailAlertAction } from '@/entities/mail-alert/actions/confirmMailAlertAction';
import { getMailAlertStateAction } from '@/entities/mail-alert/actions/getMailAlertStateAction';
import { removeMailAlertTopicAction } from '@/entities/mail-alert/actions/removeMailAlertTopicAction';
import { requestMailAlertCodeAction } from '@/entities/mail-alert/actions/requestMailAlertCodeAction';
import { setMailAlertIncludePortfolioAction } from '@/entities/mail-alert/actions/setMailAlertIncludePortfolioAction';
import { unsubscribeMailAlertAction } from '@/entities/mail-alert/actions/unsubscribeMailAlertAction';
import { MAIL_ALERT_HONEYPOT_FIELD } from '@/entities/mail-alert/lib/mailAlertConstants';
import { createMailAlertDeps } from '@/entities/mail-alert/server/createMailAlertDeps';
import * as flows from '@/entities/mail-alert/server/mailAlertFlows';

const DEPS = { marker: 'deps' } as unknown as Awaited<
    ReturnType<typeof createMailAlertDeps>
>;
const TOPIC = { kind: 'symbol', symbol: 'AAPL' };

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    Object.entries(fields).forEach(([name, value]) => data.set(name, value));
    return data;
}

/** 액션마다: 호출하는 법, 흐름 모의, 닫혔을 때의 답. */
const ACTIONS = [
    {
        name: 'getMailAlertStateAction',
        run: () => getMailAlertStateAction(TOPIC),
        flow: flows.getMailAlertState,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'requestMailAlertCodeAction',
        run: () =>
            requestMailAlertCodeAction(
                { status: 'idle' },
                form({ email: 'a@example.com' })
            ),
        flow: flows.requestMailAlertCodeFlow,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'confirmMailAlertAction',
        run: () =>
            confirmMailAlertAction(
                { status: 'idle' },
                form({ email: 'a@example.com', code: '123456', kind: 'symbol' })
            ),
        flow: flows.confirmMailAlertFlow,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'addMailAlertTopicAction',
        run: () => addMailAlertTopicAction(TOPIC, false),
        flow: flows.addMailAlertTopicFlow,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'removeMailAlertTopicAction',
        run: () => removeMailAlertTopicAction(TOPIC),
        flow: flows.removeMailAlertTopicFlow,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'unsubscribeMailAlertAction',
        run: () => unsubscribeMailAlertAction(),
        flow: flows.unsubscribeMailAlertFlow,
        fallback: { status: 'unavailable' },
    },
    {
        name: 'setMailAlertIncludePortfolioAction',
        run: () => setMailAlertIncludePortfolioAction(true),
        flow: flows.setMailAlertIncludePortfolioFlow,
        fallback: { status: 'unavailable' },
    },
] as const;

beforeEach(() => {
    vi.clearAllMocks();
    launched.value = true;
    priceLaunched.value = true;
    vi.mocked(createMailAlertDeps).mockResolvedValue(DEPS);
});

describe.each(ACTIONS)('$name', ({ run, flow, fallback, name }) => {
    it('공개 전이면 의존성도 만들지 않고 unavailable이다', async () => {
        launched.value = false;

        await expect(run()).resolves.toEqual(fallback);
        expect(createMailAlertDeps).not.toHaveBeenCalled();
        expect(flow).not.toHaveBeenCalled();
    });

    it('테이블이 없는 환경(42P01)은 조용히 unavailable이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(flow).mockRejectedValue({ cause: { code: '42P01' } });

        await expect(run()).resolves.toEqual(fallback);
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('그 밖의 오류는 질의 값을 가려 한 줄 남기고 unavailable로 답한다', async () => {
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
        vi.mocked(createMailAlertDeps).mockRejectedValue(new Error('db'));

        await expect(run()).resolves.toEqual(fallback);
        error.mockRestore();
    });
});

describe('입력 전달', () => {
    it('getMailAlertStateAction은 항목을 그대로 넘긴다', async () => {
        vi.mocked(flows.getMailAlertState).mockResolvedValue({
            status: 'new',
            accountEmail: null,
        });

        await expect(getMailAlertStateAction(TOPIC)).resolves.toEqual({
            status: 'new',
            accountEmail: null,
        });
        expect(flows.getMailAlertState).toHaveBeenCalledWith(DEPS, TOPIC);
    });

    it('requestMailAlertCodeAction은 주소와 봇 함정 값을 읽는다', async () => {
        vi.mocked(flows.requestMailAlertCodeFlow).mockResolvedValue({
            status: 'code_sent',
            email: 'a@example.com',
        });

        await requestMailAlertCodeAction(
            { status: 'idle' },
            form({
                email: 'a@example.com',
                [MAIL_ALERT_HONEYPOT_FIELD]: 'spam',
            })
        );
        await requestMailAlertCodeAction(
            { status: 'idle' },
            form({ email: 'b@example.com' })
        );

        expect(flows.requestMailAlertCodeFlow).toHaveBeenCalledWith(DEPS, {
            email: 'a@example.com',
            honeypotFilled: true,
        });
        expect(flows.requestMailAlertCodeFlow).toHaveBeenCalledWith(DEPS, {
            email: 'b@example.com',
            honeypotFilled: false,
        });
    });

    it('confirmMailAlertAction은 주소·코드·폼 전체(항목 필드)를 넘긴다', async () => {
        vi.mocked(flows.confirmMailAlertFlow).mockResolvedValue({
            status: 'wrong_code',
        });
        const data = form({
            email: 'a@example.com',
            code: '123456',
            kind: 'symbol',
            symbol: 'AAPL',
        });

        await confirmMailAlertAction({ status: 'idle' }, data);

        expect(flows.confirmMailAlertFlow).toHaveBeenCalledWith(DEPS, {
            email: 'a@example.com',
            code: '123456',
            topicInput: data,
        });
    });

    it('addMailAlertTopicAction은 includePortfolio를 참/거짓으로만 받는다', async () => {
        vi.mocked(flows.addMailAlertTopicFlow).mockResolvedValue({
            status: 'needs_code',
        });

        await addMailAlertTopicAction(TOPIC, true);
        await addMailAlertTopicAction(TOPIC, 'yes' as unknown as boolean);

        expect(flows.addMailAlertTopicFlow).toHaveBeenCalledWith(DEPS, TOPIC, {
            includePortfolio: true,
        });
        expect(flows.addMailAlertTopicFlow).toHaveBeenCalledWith(DEPS, TOPIC, {
            includePortfolio: false,
        });
    });

    it('설정 링크는 두 문자열일 때만 넘기고 모양이 틀리면 버린다', async () => {
        vi.mocked(flows.removeMailAlertTopicFlow).mockResolvedValue({
            status: 'ok',
        });
        vi.mocked(flows.unsubscribeMailAlertFlow).mockResolvedValue({
            status: 'ok',
        });

        await removeMailAlertTopicAction(TOPIC, { s: 'id', sig: 'x' });
        await removeMailAlertTopicAction(TOPIC, { s: 1 } as never);
        await unsubscribeMailAlertAction({ s: 'id', sig: 'x' });
        await unsubscribeMailAlertAction('bad' as never);

        expect(flows.removeMailAlertTopicFlow).toHaveBeenCalledWith(
            DEPS,
            TOPIC,
            { s: 'id', sig: 'x' }
        );
        expect(flows.removeMailAlertTopicFlow).toHaveBeenCalledWith(
            DEPS,
            TOPIC,
            undefined
        );
        expect(flows.unsubscribeMailAlertFlow).toHaveBeenCalledWith(DEPS, {
            s: 'id',
            sig: 'x',
        });
        expect(flows.unsubscribeMailAlertFlow).toHaveBeenCalledWith(
            DEPS,
            undefined
        );
    });

    it('setMailAlertIncludePortfolioAction은 값을 참/거짓으로만 받는다', async () => {
        vi.mocked(flows.setMailAlertIncludePortfolioFlow).mockResolvedValue({
            status: 'ok',
        });

        await setMailAlertIncludePortfolioAction(true);
        await setMailAlertIncludePortfolioAction('x' as unknown as boolean);

        expect(flows.setMailAlertIncludePortfolioFlow).toHaveBeenCalledWith(
            DEPS,
            true
        );
        expect(flows.setMailAlertIncludePortfolioFlow).toHaveBeenCalledWith(
            DEPS,
            false
        );
    });
});

describe('cancelPriceAlertAction', () => {
    const ALERT_ID = '3f0c8e3e-6b9a-4e4d-9d3a-1a2b3c4d5e6f';
    const UNAVAILABLE = { status: 'unavailable' };

    it('가격대 알림 공개 전이면 의존성도 만들지 않고 unavailable이다', async () => {
        priceLaunched.value = false;

        await expect(cancelPriceAlertAction(ALERT_ID)).resolves.toEqual(
            UNAVAILABLE
        );
        expect(createMailAlertDeps).not.toHaveBeenCalled();
        expect(flows.cancelPriceAlertFlow).not.toHaveBeenCalled();
    });

    it('알림 id와 설정 링크를 흐름에 넘기고 모양이 틀린 링크는 버린다', async () => {
        vi.mocked(flows.cancelPriceAlertFlow).mockResolvedValue({
            status: 'ok',
        });

        await cancelPriceAlertAction(ALERT_ID, { s: 'id', sig: 'x' });
        await cancelPriceAlertAction(ALERT_ID, { s: 1 } as never);

        expect(flows.cancelPriceAlertFlow).toHaveBeenCalledWith(
            DEPS,
            ALERT_ID,
            { s: 'id', sig: 'x' }
        );
        expect(flows.cancelPriceAlertFlow).toHaveBeenCalledWith(
            DEPS,
            ALERT_ID,
            undefined
        );
    });

    it('테이블이 없는 환경(42P01)은 조용히 unavailable이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(flows.cancelPriceAlertFlow).mockRejectedValue({
            cause: { code: '42P01' },
        });

        await expect(cancelPriceAlertAction(ALERT_ID)).resolves.toEqual(
            UNAVAILABLE
        );
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('그 밖의 오류는 질의 값을 가려 한 줄 남기고 unavailable로 답한다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(flows.cancelPriceAlertFlow).mockRejectedValue(
            plantedDbError()
        );

        await expect(cancelPriceAlertAction(ALERT_ID)).resolves.toEqual(
            UNAVAILABLE
        );
        expectLogWithoutPlantedSecrets(error);
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('[cancelPriceAlertAction]'),
            expect.anything()
        );
        error.mockRestore();
    });

    it('의존성을 만들다 던져도 던지지 않는다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(createMailAlertDeps).mockRejectedValue(new Error('db'));

        await expect(cancelPriceAlertAction(ALERT_ID)).resolves.toEqual(
            UNAVAILABLE
        );
        error.mockRestore();
    });
});
