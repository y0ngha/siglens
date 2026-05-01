import type { ContactRepository } from '@/infrastructure/db/contactRepository';

/** Dependencies required by the `submitInquiry` use-case. */
export interface SubmitInquiryDeps {
    contactRepository: ContactRepository;
}
