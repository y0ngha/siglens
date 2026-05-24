'use client';

import { useLogout } from '../hooks/useLogout';

export function LogoutButton() {
    const { pending, logout } = useLogout();
    return (
        <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={logout}
            className="text-secondary-200 hover:bg-secondary-800 focus-visible:ring-primary-500 flex w-full items-center rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
            {pending ? '로그아웃 중…' : '로그아웃'}
        </button>
    );
}
