import type { MockInstance } from 'vitest';
const { mockSubmitInquiry, mockCreate } = vi.hoisted(() => ({
    mockSubmitInquiry: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('../api', () => ({
    DrizzleContactRepository: vi.fn().mockImplementation(function () {
        return {
            create: mockCreate,
        };
    }),
}));
vi.mock('../lib/submitInquiry', () => ({
    submitInquiry: (...args: unknown[]) => mockSubmitInquiry(...args),
}));

import { submitRadarRequestAction } from '../actions/submitRadarRequestAction';
import type { RadarRequestFormState } from '../lib/types';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const INITIAL_STATE: RadarRequestFormState = {
    submitted: false,
    error: null,
    values: { symbol: '', email: '' },
};

describe('submitRadarRequestAction', () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitInquiry.mockResolvedValue(undefined);
        mockCreate.mockResolvedValue(undefined);
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('이메일 없이도 저장하며 email 은 null 로 넘긴다', async () => {
        const result = await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ symbol: ' PLTR ', email: '' })
        );

        expect(result.submitted).toBe(true);
        expect(result.error).toBeNull();
        expect(result.values).toEqual({ symbol: 'PLTR', email: '' });
        expect(mockSubmitInquiry).toHaveBeenCalledTimes(1);
        const [input] = mockSubmitInquiry.mock.calls.find(
            ([arg]) => arg?.content === 'PLTR'
        )!;
        expect(input).toEqual({
            title: '[Radar request] PLTR',
            content: 'PLTR',
            email: null,
        });
    });

    it('이메일이 있으면 trim 해서 그대로 저장한다', async () => {
        await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ symbol: 'NVDA', email: ' me@example.com ' })
        );

        const [input] = mockSubmitInquiry.mock.calls.find(
            ([arg]) => arg?.content === 'NVDA'
        )!;
        expect(input.email).toBe('me@example.com');
    });

    it('성공하면 trim 된 종목과 이메일을 values 로 돌려준다', async () => {
        const result = await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ symbol: ' AMD ', email: ' me@example.com ' })
        );

        expect(result.values).toEqual({
            symbol: 'AMD',
            email: 'me@example.com',
        });
    });

    it('종목이 비어 있으면 symbol_required 를 돌려주고 저장하지 않는다', async () => {
        const result = await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ email: 'me@example.com' })
        );

        expect(result.submitted).toBe(false);
        expect(result.error).toEqual({
            code: 'symbol_required',
            field: 'symbol',
        });
        expect(result.values).toEqual({
            symbol: '',
            email: 'me@example.com',
        });
        expect(mockSubmitInquiry).not.toHaveBeenCalled();
    });

    it('이메일 형식이 틀리면 email_invalid 를 돌려주고 입력값을 보존한다', async () => {
        const result = await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ symbol: 'PLTR', email: 'invalid' })
        );

        expect(result.error).toEqual({ code: 'email_invalid', field: 'email' });
        expect(result.values).toEqual({ symbol: 'PLTR', email: 'invalid' });
        expect(mockSubmitInquiry).not.toHaveBeenCalled();
    });

    it('저장이 throw 하면 submission_failed 와 원본 입력값을 돌려준다', async () => {
        mockSubmitInquiry.mockRejectedValueOnce(
            new Error('db connection lost')
        );

        const result = await submitRadarRequestAction(
            INITIAL_STATE,
            makeFormData({ symbol: 'PLTR', email: 'me@example.com' })
        );

        expect(result.submitted).toBe(false);
        expect(result.error).toEqual({ code: 'submission_failed' });
        expect(result.values).toEqual({
            symbol: 'PLTR',
            email: 'me@example.com',
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[submitRadarRequestAction] Failed to persist radar request',
            { name: 'Error', code: undefined }
        );
    });

    it('로그 인자에 Error 인스턴스나 입력값이 담긴 문자열을 남기지 않는다', async () => {
        const values = { symbol: 'PLTR', email: 'me@example.com' };
        mockSubmitInquiry.mockRejectedValueOnce(
            new Error(
                `Failed query: insert\nparams: ${values.symbol},${values.email}`
            )
        );

        await submitRadarRequestAction(INITIAL_STATE, makeFormData(values));

        const loggedArgs = consoleErrorSpy.mock.calls.flat();
        expect(loggedArgs.some(arg => arg instanceof Error)).toBe(false);
        const serialized = loggedArgs.map(arg => JSON.stringify(arg)).join('');
        for (const value of Object.values(values)) {
            expect(serialized).not.toContain(value);
        }
    });
});
