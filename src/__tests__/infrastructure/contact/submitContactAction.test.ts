import { submitContactAction } from '@/infrastructure/contact/submitContactAction';
import type { ContactFormState } from '@/domain/contact/formTypes';
import { makeFormData } from '@/__tests__/utils/makeFormData';

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
    describe('검증 통과', () => {
        it('모든 필드가 유효하면 submitted: true 와 빈 values 를 반환한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData(validForm)
            );
            expect(result).toEqual({
                submitted: true,
                error: null,
                values: { title: '', email: '', content: '' },
            });
        });
    });

    describe('검증 실패', () => {
        it('제목이 비어있으면 submitted: false 와 title_required 에러, 입력값 보존', async () => {
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
        });

        it('이메일 형식이 잘못되면 email_invalid 에러를 반환하고 raw 입력값을 보존한다', async () => {
            const result = await submitContactAction(
                INITIAL_STATE,
                makeFormData({ ...validForm, email: 'invalid' })
            );
            expect(result.submitted).toBe(false);
            expect(result.error?.code).toBe('email_invalid');
            expect(result.values.email).toBe('invalid');
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
});
