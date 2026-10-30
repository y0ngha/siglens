import type { ContactRepository } from '../api';

/** `submitInquiry`가 요구하는 의존성. */
export interface SubmitInquiryDeps {
    contactRepository: ContactRepository;
}
