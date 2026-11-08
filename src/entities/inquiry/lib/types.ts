import type { ContactRepository } from '../api';

/** `submitInquiry`가 요구하는 의존성. */
export interface SubmitInquiryDeps {
    contactRepository: ContactRepository;
}

/** 레이더 종목 요청 폼에서 오류가 붙을 수 있는 입력 필드. */
export type RadarRequestField = 'symbol' | 'email';

/** 레이더 종목 요청 폼의 오류 코드. 표시 문구는 소비자가 코드로 번역한다. */
export type RadarRequestErrorCode =
    | 'symbol_required'
    | 'symbol_too_long'
    | 'email_invalid'
    | 'submission_failed';

/** 레이더 종목 요청 폼의 오류. `field`가 없으면 폼 단위(전송 실패) 오류다. */
export interface RadarRequestError {
    code: RadarRequestErrorCode;
    field?: RadarRequestField;
}

/** 폼 입력값. 비제어 입력의 기본값으로 되살리므로 trim 전 원문을 담는다. */
export interface RadarRequestValues {
    symbol: string;
    email: string;
}

/** 종목 요청 Server Action의 `useActionState` 상태. */
export interface RadarRequestFormState {
    submitted: boolean;
    error: RadarRequestError | null;
    values: RadarRequestValues;
}
