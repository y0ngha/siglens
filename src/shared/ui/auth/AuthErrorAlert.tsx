import type { ReactNode } from 'react';

interface AuthErrorAlertProps {
    message: ReactNode;
}

export function AuthErrorAlert({ message }: AuthErrorAlertProps) {
    return (
        <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-3 text-sm text-ui-danger"
        >
            <span aria-hidden>⚠</span>
            <p>{message}</p>
        </div>
    );
}
