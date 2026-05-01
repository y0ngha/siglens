import type {
    ContactInput,
    ContactRepository,
} from '@/infrastructure/db/contactRepository';
import { submitInquiry } from '@/infrastructure/contact/use-cases/submitInquiry';
import type { SubmitInquiryDeps } from '@/infrastructure/contact/use-cases/types';

function makeDeps(): {
    deps: SubmitInquiryDeps;
    create: jest.Mock;
} {
    const create = jest.fn<
        ReturnType<ContactRepository['create']>,
        Parameters<ContactRepository['create']>
    >();
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
        const create = jest.fn<
            ReturnType<ContactRepository['create']>,
            Parameters<ContactRepository['create']>
        >();
        create.mockRejectedValue(dbError);
        const deps: SubmitInquiryDeps = {
            contactRepository: { create },
        };

        await expect(submitInquiry(validInput, deps)).rejects.toThrow(
            'db connection lost'
        );
    });
});
