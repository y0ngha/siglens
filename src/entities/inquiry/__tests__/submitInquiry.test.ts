import type { Mock } from 'vitest';
import type { ContactInput, ContactRepository } from '@/entities/inquiry';
import { submitInquiry } from '../lib/submitInquiry';
import type { SubmitInquiryDeps } from '../lib/types';

function makeDeps(): {
    deps: SubmitInquiryDeps;
    create: Mock<ContactRepository['create']>;
} {
    const create = vi.fn<ContactRepository['create']>();
    create.mockResolvedValue(undefined);
    const contactRepository: ContactRepository = { create };
    return {
        deps: { contactRepository },
        create,
    };
}

const validInput: ContactInput = {
    title: 'Test title',
    content: 'Test content body',
    email: 'visitor@example.com',
};

describe('submitInquiry', () => {
    it('calls repository.create with the exact input', async () => {
        const { deps, create } = makeDeps();

        await submitInquiry(validInput, deps);

        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith(validInput);
    });

    it('propagates repository errors to the caller', async () => {
        const dbError = new Error('db connection lost');
        const create = vi.fn<ContactRepository['create']>();
        create.mockRejectedValue(dbError);
        const deps: SubmitInquiryDeps = {
            contactRepository: { create },
        };

        await expect(submitInquiry(validInput, deps)).rejects.toThrow(
            'db connection lost'
        );
    });
});
