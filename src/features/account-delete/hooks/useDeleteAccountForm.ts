'use client';

import { useActionState } from 'react';
import type { DeleteAccountFormState } from '@/shared/lib/types';
import { deleteAccountAction } from '../actions/deleteAccountAction';

const INITIAL_STATE: DeleteAccountFormState = { error: null };

type UseDeleteAccountFormReturn = ReturnType<
    typeof useActionState<DeleteAccountFormState, FormData>
>;

export function useDeleteAccountForm(): UseDeleteAccountFormReturn {
    return useActionState<DeleteAccountFormState, FormData>(
        deleteAccountAction,
        INITIAL_STATE
    );
}
