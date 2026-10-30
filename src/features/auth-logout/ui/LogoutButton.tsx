'use client';

import { useTranslations } from 'next-intl';
import { useLogout } from '../hooks/useLogout';

export function LogoutButton() {
    const t = useTranslations('features.auth-logout');
    const { pending, logout } = useLogout();
    return (
        <button
            type="button"
            aria-disabled={pending}
            onClick={() => {
                // `disabled`는 포커스를 body로 떨어뜨린다(REACT.md#AX-3) — 대기 중에는 눌러도 무시한다.
                if (!pending) logout();
            }}
            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none aria-disabled:cursor-default aria-disabled:text-secondary-500"
        >
            {pending ? t('LogoutButton.3bc873') : t('LogoutButton.3879f0')}
        </button>
    );
}
