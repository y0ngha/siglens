import type { ContactInput } from '../api';
import type { SubmitInquiryDeps } from './types';

/** 검증된 문의를 주입된 repository로 저장한다. 액션이 DB 구현을 조립해 넘긴다. */
export async function submitInquiry(
    input: ContactInput,
    deps: SubmitInquiryDeps
): Promise<void> {
    await deps.contactRepository.create(input);
}
