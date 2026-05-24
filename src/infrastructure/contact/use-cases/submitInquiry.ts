import type { ContactInput } from '@/entities/inquiry';
import type { SubmitInquiryDeps } from '@/infrastructure/contact/use-cases/types';

/** Persist a visitor's contact form submission to the database. */
export async function submitInquiry(
    input: ContactInput,
    deps: SubmitInquiryDeps
): Promise<void> {
    await deps.contactRepository.create(input);
}
