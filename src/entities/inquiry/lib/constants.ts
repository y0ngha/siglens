export {
    /** 문의 본문 최대 길이. 폼 검증과 입력 UI가 공유한다. */
    CONTACT_CONTENT_MAX_LENGTH,
    /** 문의 제목 최대 길이. 폼 검증과 입력 UI가 공유한다. */
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';
export {
    /** 이메일 최대 길이. DB 컬럼(`varchar`)과 같은 단일 출처 값이다. */
    EMAIL_MAX_LENGTH as CONTACT_EMAIL_MAX_LENGTH,
} from '@/shared/config/email';

import { EMAIL_MAX_LENGTH as CONTACT_EMAIL_MAX_LENGTH } from '@/shared/config/email';

/** 이메일 형식 검사 패턴. 공백·`@` 없는 로컬/도메인 + 점이 있는 도메인을 요구한다. */
export const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** 이메일 길이·형식 검사. 문의 폼과 종목 요청 폼이 같은 정책을 쓰도록 한 곳에 둔다. */
export function isValidContactEmail(email: string): boolean {
    return (
        email.length <= CONTACT_EMAIL_MAX_LENGTH &&
        CONTACT_EMAIL_PATTERN.test(email)
    );
}
