import { useTranslations } from 'next-intl';
import {
    MIN_PASSWORD_LENGTH,
    hasLetter,
    hasMinLength,
    hasNumber,
} from '@/shared/lib/auth/passwordRules';
import { cn } from '@/shared/lib/cn';

interface PasswordStrengthHintProps {
    password: string;
    descriptionId?: string;
}

interface Rule {
    id: string;
    /** `shared.ui.passwordRule` 키. 길이 규칙만 `{v0}`을 받는다. */
    labelKey: string;
    test: (password: string) => boolean;
}

const RULES: readonly Rule[] = [
    { id: 'length', labelKey: 'minLength', test: hasMinLength },
    { id: 'letter', labelKey: 'hasLetter', test: hasLetter },
    { id: 'number', labelKey: 'hasNumber', test: hasNumber },
];

export function PasswordStrengthHint({
    password,
    descriptionId,
}: PasswordStrengthHintProps) {
    const t = useTranslations('shared.ui.passwordRule');
    return (
        <ul
            id={descriptionId}
            className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs"
        >
            {RULES.map(rule => {
                const ok = rule.test(password);
                return (
                    <li
                        key={rule.id}
                        className={cn(
                            ok ? 'text-ui-success' : 'text-secondary-500'
                        )}
                    >
                        <span aria-hidden>{ok ? '✓' : '○'}</span>
                        <span className="ml-1.5">
                            {t(rule.labelKey, { v0: MIN_PASSWORD_LENGTH })}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
