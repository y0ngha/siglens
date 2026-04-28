import {
    MIN_PASSWORD_LENGTH,
    hasLetter,
    hasMinLength,
    hasNumber,
} from '@/domain/auth/passwordRules';
import { cn } from '@/lib/cn';

interface PasswordStrengthHintProps {
    password: string;
    descriptionId?: string;
}

interface Rule {
    id: string;
    label: string;
    test: (password: string) => boolean;
}

const RULES: readonly Rule[] = [
    {
        id: 'length',
        label: `${MIN_PASSWORD_LENGTH}자 이상`,
        test: hasMinLength,
    },
    { id: 'letter', label: '영문 포함', test: hasLetter },
    { id: 'number', label: '숫자 포함', test: hasNumber },
];

export function PasswordStrengthHint({
    password,
    descriptionId,
}: PasswordStrengthHintProps) {
    return (
        <ul id={descriptionId} className="mt-1 space-y-1 text-xs">
            {RULES.map(rule => {
                const ok = rule.test(password);
                return (
                    <li
                        key={rule.id}
                        className={cn(
                            ok ? 'text-emerald-300' : 'text-secondary-500'
                        )}
                    >
                        <span aria-hidden>{ok ? '✓' : '○'}</span>
                        <span className="ml-1.5">{rule.label}</span>
                    </li>
                );
            })}
        </ul>
    );
}
