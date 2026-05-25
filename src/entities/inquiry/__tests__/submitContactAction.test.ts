import { vi, type MockInstance } from 'vitest';
const { mockSubmitInquiry, mockCreate } = vi.hoisted(() => ({
    mockSubmitInquiry: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/entities/inquiry', () => ({
    DrizzleContactRepository: vi.fn().mockImplementation(function () {
        return {
            create: mockCreate,
        };
    }),
}));
vi.mock('../lib/submitInquiry', () => ({
    submitInquiry: (...args: unknown[]) => mockSubmitInquiry(...args),
}));

import { submitContactAction } from '../actions/submitContactAction';
import type { ContactFormState } from '@/shared/lib/types';
import { makeFormData } from '@/shared/test-utils/makeFormData';

const INITIAL_STATE: ContactFormState = {
    submitted: false,
    error: null,
    values: { title: '', email: '', content: '' },
};

const validForm = {
    title: '문의 제목',
    email: 'user@example.com',
    content: '문의 내용입니다.',
};

describe('submitContactAction', () => {
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

    describe('검증 성공 + 저장 성공', () => {
        it('모든 필드가 유효하고 저장이 성공하면 submitted: true, error: null, trim된 values 를 반환한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData(validForm)
            );
            expect(result.submitted).toBe(true);
            expect(result.error).toBeNull();
            expect(result.values).toEqual({
                title: validForm.title,
                email: validForm.email,
                content: validForm.content,
            });
        });

        it('submitInquiry 를 trim 된 입력값으로 호출한다', async () => {
            await submitContactAction(
                INITIAL_STATE,
                makeFormData({
                    title: '  문의 제목  ',
                    email: '  user@example.com  ',
                    content: '  문의 내용입니다.  ',
                })
            );
            expect(mockSubmitInquiry).toHaveBeenCalledTimes(1);
            const [input] = mockSubmitInquiry.mock.calls[0];
            expect(input).toEqual({
                title: '문의 제목',
                email: 'user@example.com',
                content: '문의 내용입니다.',
            });
        });
    });

    describe('검증 실패', () => {
        it('제목이 비어있으면 submitted: false 와 title_required 에러, 입력값 보존, submitInquiry 호출 없음', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData({ ...validForm, title: '' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('title_required');
            expect(result.values).toEqual({
                title: '',
                email: validForm.email,
                content: validForm.content,
            });
            expect(mockSubmitInquiry).not.toHaveBeenCalled();
        });

        it('이메일 형식이 잘못되면 email_invalid 에러를 반환하고 raw 입력값을 보존한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData({ ...validForm, email: 'invalid' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('email_invalid');
            expect(result.values.email).toBe('invalid');
            expect(mockSubmitInquiry).not.toHaveBeenCalled();
        });

        it('내용이 비어있으면 content_required 에러를 반환한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData({ ...validForm, content: '   ' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('content_required');
            expect(result.values.content).toBe('   ');
        });
    });

    describe('FormData 정규화', () => {
        it('필드가 누락되면 빈 문자열로 처리하여 검증 실패를 반환한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData({})
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('title_required');
            expect(result.values).toEqual({
                title: '',
                email: '',
                content: '',
            });
        });
    });

    describe('저장 실패', () => {
        it('repo 가 throw 하면 submission_failed 에러와 raw 입력값을 반환한다', async () => {
            mockSubmitInquiry.mockRejectedValueOnce(
                new Error('db connection lost')
            );

            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData(validForm)
            );

            expect(result.submitted).toBe(false);
            expect(result.error).toEqual({ code: 'submission_failed' });
            expect(result.values).toEqual(validForm);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });
});
