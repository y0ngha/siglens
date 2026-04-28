import type { ReactNode } from 'react';

interface AuthErrorAlertProps {
    message: ReactNode;
}

export function AuthErrorAlert({ message }: AuthErrorAlertProps) {
    return (
        <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-200"
        >
            <span aria-hidden>⚠</span>
            <p>{message}</p>
        </div>
    );
}
