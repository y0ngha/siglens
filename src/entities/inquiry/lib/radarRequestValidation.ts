import { RADAR_REQUEST_SYMBOL_MAX_LENGTH } from '@/shared/config/radar';
import type { ContactInput } from '../api';
import { CONTACT_EMAIL_MAX_LENGTH, CONTACT_EMAIL_PATTERN } from './constants';
import type {
    RadarRequestError,
    RadarRequestField,
    RadarRequestValues,
} from './types';

/**
 * 문의 제목 접두어. 운영자가 `inquiries`에서 종목 요청을 가려내는 표식이라 DB 값이다 —
 * 화면 문구가 아니므로 번역하지 않고, 한글 리터럴이 카탈로그 린트에 걸리지 않게 ASCII로 둔다.
 */
const RADAR_REQUEST_TITLE_PREFIX = '[Radar request]';

/** 검증을 통과한 입력. 문의 저장소가 받는 모양 그대로다. */
interface RadarRequestValidationSuccess {
    ok: true;
    values: ContactInput;
}

/** 검증 실패 결과. */
interface RadarRequestValidationFailure {
    ok: false;
    error: RadarRequestError;
}

/** `validateRadarRequestInput`의 판별 유니온 결과. */
export type RadarRequestValidationResult =
    | RadarRequestValidationSuccess
    | RadarRequestValidationFailure;

/**
 * 종목 요청 입력을 trim한 뒤 종목(필수·길이)과 이메일(선택·형식)을 검사한다.
 * 이메일을 비워 두면 `null`로 저장한다.
 */
export function validateRadarRequestInput(
    raw: RadarRequestValues
): RadarRequestValidationResult {
    const symbol = raw.symbol.trim();
    const email = raw.email.trim();

    if (symbol.length === 0) {
        return failure('symbol_required', 'symbol');
    }
    if (symbol.length > RADAR_REQUEST_SYMBOL_MAX_LENGTH) {
        return failure('symbol_too_long', 'symbol');
    }
    if (
        email.length > 0 &&
        (email.length > CONTACT_EMAIL_MAX_LENGTH ||
            !CONTACT_EMAIL_PATTERN.test(email))
    ) {
        return failure('email_invalid', 'email');
    }

    return {
        ok: true,
        values: {
            title: `${RADAR_REQUEST_TITLE_PREFIX} ${symbol}`,
            content: symbol,
            email: email.length === 0 ? null : email,
        },
    };
}

function failure(
    code: RadarRequestError['code'],
    field: RadarRequestField
): RadarRequestValidationFailure {
    return { ok: false, error: { code, field } };
}
