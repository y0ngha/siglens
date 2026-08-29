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
    const t = useTranslations('shared.ui');
    const tRule = useTranslations('shared.ui.passwordRule');
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
                            ok ? 'text-ui-success-text' : 'text-secondary-500'
                        )}
                    >
                        <span aria-hidden>{ok ? '✓' : '○'}</span>
                        <span className="ml-1.5">
                            {tRule(rule.labelKey, { v0: MIN_PASSWORD_LENGTH })}
                        </span>
                        {/*
                         * 보조기술에는 상태가 전혀 가지 않고 있었다. 눈으로는
                         * ✓/○ 모양이 색과 별개로 구분을 주지만 그 글리프가
                         * `aria-hidden`이고, 라벨 문자열("8자 이상")은 충족
                         * 여부와 무관하게 동일하다 — 스크린리더 사용자는 규칙
                         * 세 개를 한 번 듣고 무엇이 모자란지는 끝내 알 수 없었다.
                         *
                         * `aria-live`는 붙이지 않는다. 이 목록은 입력의
                         * `aria-describedby` 대상이라 타이핑 한 글자마다
                         * 읽어주면 입력 자체를 방해한다. 상태를 텍스트로
                         * 노출해 두면 사용자가 필드로 되돌아올 때 함께 읽힌다.
                         */}
                        <span className="sr-only">
                            {ok
                                ? t('PasswordStrengthHint.eba437')
                                : t('PasswordStrengthHint.6fa4dd')}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
