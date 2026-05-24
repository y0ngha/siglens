import type { ReactNode } from 'react';

interface AuthErrorAlertProps {
    message: ReactNode;
}

export function AuthErrorAlert({ message }: AuthErrorAlertProps) {
    return (
        <div
            role="alert"
            className="border-ui-danger/30 bg-ui-danger/5 text-ui-danger mb-4 flex items-start gap-2 rounded-md border p-3 text-sm"
        >
            <span aria-hidden>⚠</span>
            <p>{message}</p>
        </div>
    );
}
