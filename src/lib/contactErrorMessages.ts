import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/domain/contact/constants';
import type { ContactFormErrorCode } from '@/domain/contact/formTypes';

export const CONTACT_ERROR_MESSAGES: Record<ContactFormErrorCode, string> = {
    title_required: '제목을 입력해 주세요.',
    title_too_long: `제목은 ${CONTACT_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`,
    email_required: '이메일을 입력해 주세요.',
    email_invalid: '올바른 이메일 형식이 아닙니다.',
    content_required: '문의 내용을 입력해 주세요.',
    content_too_long: `문의 내용은 ${CONTACT_CONTENT_MAX_LENGTH}자 이내로 입력해 주세요.`,
    submission_failed: '문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
};
