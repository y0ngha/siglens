/**
 * Quick branch coverage tests for miscellaneous 1-branch gaps.
 */

import { getFieldError } from '@/features/contact-form/lib/contactFormUtils';
import type { ContactFormError } from '@/shared/lib/types';
import { CONTACT_ERROR_KEY } from '@/shared/lib/contactErrorMessages';

describe('contactFormUtils — getFieldError matching field branch', () => {
    it('returns error message when field matches', () => {
        const error: ContactFormError = {
            field: 'email',
            code: 'email_required',
        };

        // 번역자는 키를 그대로 돌려주는 identity stub — 이 테스트가 보는 건
        // 필드 일치 분기이지 문구가 아니다.
        const result = getFieldError(error, 'email', key => key);
        expect(result).toBe(CONTACT_ERROR_KEY.email_required);
    });
});
