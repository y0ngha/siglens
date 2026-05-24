import type { ContactRepository } from '@/entities/inquiry';

/** Dependencies required by the `submitInquiry` use-case. */
export interface SubmitInquiryDeps {
    contactRepository: ContactRepository;
}
