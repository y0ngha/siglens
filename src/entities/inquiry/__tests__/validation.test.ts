import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/entities/inquiry/lib/constants';
import {
    type ValidationFailure,
    type ValidationResult,
    validateContactInput,
} from '@/entities/inquiry/lib/validation';

function expectFailure(result: ValidationResult): ValidationFailure {
    if (result.ok) {
        throw new Error('Expected validation to fail, but it succeeded');
    }
    return result;
}

describe('validateContactInput', () => {
    const validInput = {
        title: '문의합니다',
        email: 'user@example.com',
        content: '서비스 사용 중 궁금한 점이 있어 문의드립니다.',
    };

    describe('정상 입력', () => {
        it('모든 필드가 유효하면 ok: true 와 trim된 값을 반환한다', () => {
            const result = validateContactInput({
                title: '  안녕하세요  ',
                email: '  user@example.com  ',
                content: '  본문 내용입니다.  ',
            });
            expect(result).toEqual({
                ok: true,
                values: {
                    title: '안녕하세요',
                    email: 'user@example.com',
                    content: '본문 내용입니다.',
                },
            });
        });
    });

    describe('제목(title) 검증', () => {
        it('제목이 비어있으면 title_required 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, title: '' })
            );
            expect(result.error.code).toBe('title_required');
            expect(result.error.field).toBe('title');
        });

        it('제목이 공백만 있으면 title_required 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, title: '   ' })
            );
            expect(result.error.code).toBe('title_required');
        });

        it(`제목이 ${CONTACT_TITLE_MAX_LENGTH}자 초과면 title_too_long 에러를 반환한다`, () => {
            const result = expectFailure(
                validateContactInput({
                    ...validInput,
                    title: 'a'.repeat(CONTACT_TITLE_MAX_LENGTH + 1),
                })
            );
            expect(result.error.code).toBe('title_too_long');
            expect(result.error.field).toBe('title');
        });

        it(`제목이 정확히 ${CONTACT_TITLE_MAX_LENGTH}자면 통과한다`, () => {
            const result = validateContactInput({
                ...validInput,
                title: 'a'.repeat(CONTACT_TITLE_MAX_LENGTH),
            });
            expect(result.ok).toBe(true);
        });
    });

    describe('이메일(email) 검증', () => {
        it('이메일이 비어있으면 email_required 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, email: '' })
            );
            expect(result.error.code).toBe('email_required');
            expect(result.error.field).toBe('email');
        });

        it('@가 없으면 email_invalid 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({
                    ...validInput,
                    email: 'invalid-email',
                })
            );
            expect(result.error.code).toBe('email_invalid');
            expect(result.error.field).toBe('email');
        });

        it('도메인에 .이 없으면 email_invalid 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, email: 'user@example' })
            );
            expect(result.error.code).toBe('email_invalid');
        });

        it('공백이 포함되면 email_invalid 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({
                    ...validInput,
                    email: 'user @example.com',
                })
            );
            expect(result.error.code).toBe('email_invalid');
        });
    });

    describe('내용(content) 검증', () => {
        it('내용이 비어있으면 content_required 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, content: '' })
            );
            expect(result.error.code).toBe('content_required');
            expect(result.error.field).toBe('content');
        });

        it('내용이 공백만 있으면 content_required 에러를 반환한다', () => {
            const result = expectFailure(
                validateContactInput({ ...validInput, content: '\n\t  ' })
            );
            expect(result.error.code).toBe('content_required');
        });

        it(`내용이 ${CONTACT_CONTENT_MAX_LENGTH}자 초과면 content_too_long 에러를 반환한다`, () => {
            const result = expectFailure(
                validateContactInput({
                    ...validInput,
                    content: 'a'.repeat(CONTACT_CONTENT_MAX_LENGTH + 1),
                })
            );
            expect(result.error.code).toBe('content_too_long');
            expect(result.error.field).toBe('content');
        });

        it(`내용이 정확히 ${CONTACT_CONTENT_MAX_LENGTH}자면 통과한다`, () => {
            const result = validateContactInput({
                ...validInput,
                content: 'a'.repeat(CONTACT_CONTENT_MAX_LENGTH),
            });
            expect(result.ok).toBe(true);
        });
    });

    describe('검증 우선순위', () => {
        it('제목이 비어있고 이메일도 잘못되면 제목 에러를 우선 반환한다', () => {
            const result = expectFailure(
                validateContactInput({
                    title: '',
                    email: 'invalid',
                    content: '',
                })
            );
            expect(result.error.code).toBe('title_required');
        });
    });
});
