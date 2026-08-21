'use client';

import { useTranslations } from 'next-intl';
import { useLogout } from '../hooks/useLogout';

export function LogoutButton() {
    const t = useTranslations('features.auth-logout');
    const { pending, logout } = useLogout();
    return (
        <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={logout}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none disabled:opacity-60"
        >
            {pending ? t('LogoutButton.3bc873') : t('LogoutButton.3879f0')}
        </button>
    );
}
