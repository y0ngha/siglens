/** 발급 폼 아래 상태 영역에 뜰 수 있는 안내 한 줄의 종류. */
export type CreateStatusNotice =
    | 'error'
    | 'emailNotVerified'
    | 'byokNotice'
    | 'limitHint';

/** 상태 영역이 무엇을 보여 줄지 정하는 입력. 폼이 가진 값만 담는다. */
export interface CreateStatusInput {
    /** 마지막 발급 시도가 실패했는가. */
    hasError: boolean;
    emailVerified: boolean;
    /** 활성 키가 상한에 닿았는가. */
    limitReached: boolean;
    /** 등록한 BYOK LLM 키가 하나라도 있는가. */
    hasByokKey: boolean;
}

const NOTICE_RULES: Record<
    CreateStatusNotice,
    (input: CreateStatusInput) => boolean
> = {
    error: input => input.hasError,
    emailNotVerified: input => !input.emailVerified,
    // 인증 전·상한 도달 상태에서는 발급 자체를 못 하므로 BYOK 안내는 그 다음 일이다.
    byokNotice: input =>
        input.emailVerified && !input.limitReached && !input.hasByokKey,
    // 발급 오류(대개 같은 상한 거절)가 이미 보이면 상한 안내를 겹쳐 띄우지 않는다.
    limitHint: input =>
        input.emailVerified && input.limitReached && !input.hasError,
};

/** 화면에 쌓이는 순서. 오류가 맨 앞이다. */
const NOTICE_ORDER: readonly CreateStatusNotice[] = [
    'error',
    'emailNotVerified',
    'byokNotice',
    'limitHint',
];

/**
 * 발급 폼 상태 영역에 보일 안내를 표시 순서대로 고른다. 여러 줄이 함께 뜰 수 있다
 * (예: 발급 오류 + 이메일 미인증). 문구와 색은 `CreateKeyForm`이 종류별로 붙인다.
 */
export function listCreateStatusNotices(
    input: CreateStatusInput
): CreateStatusNotice[] {
    return NOTICE_ORDER.filter(notice => NOTICE_RULES[notice](input));
}
