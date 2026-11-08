import type { Mock } from 'vitest';
import type { ContactInput, ContactRepository } from '../api';
import { submitInquiry } from '../lib/submitInquiry';
import type { OperatorNotifier, SubmitInquiryDeps } from '../lib/types';

function makeDeps(): {
    deps: SubmitInquiryDeps;
    create: Mock<ContactRepository['create']>;
    notifier: Mock<OperatorNotifier>;
} {
    const create = vi.fn<ContactRepository['create']>();
    create.mockResolvedValue(undefined);
    const notifier = vi.fn<OperatorNotifier>();
    const contactRepository: ContactRepository = { create };
    return {
        deps: { contactRepository, notifier },
        create,
        notifier,
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
        const notifier = vi.fn<OperatorNotifier>();
        const deps: SubmitInquiryDeps = {
            contactRepository: { create },
            notifier,
        };

        await expect(submitInquiry(validInput, deps)).rejects.toThrow(
            'db connection lost'
        );
        expect(notifier).not.toHaveBeenCalled();
    });

    it('notifies the operator after a successful create', async () => {
        const { deps, notifier } = makeDeps();

        await submitInquiry(validInput, deps);

        expect(notifier).toHaveBeenCalledTimes(1);
        expect(notifier).toHaveBeenCalledWith(
            expect.objectContaining({ replyTo: 'visitor@example.com' })
        );
    });
});
