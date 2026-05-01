'use client';

import { useActionState } from 'react';
import type { ContactFormState } from '@/domain/types';
import { submitContactAction } from '@/infrastructure/contact/submitContactAction';

const INITIAL_STATE: ContactFormState = {
    submitted: false,
    error: null,
    values: { title: '', email: '', content: '' },
};

type UseContactFormReturn = ReturnType<
    typeof useActionState<ContactFormState, FormData>
>;

export function useContactForm(): UseContactFormReturn {
    return useActionState<ContactFormState, FormData>(
        submitContactAction,
        INITIAL_STATE
    );
}
