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

/** 비밀번호 규칙 충족 여부 목록. `descriptionId`를 입력의 `aria-describedby`에 연결해 쓴다. */
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
                         * 눈으로는 ✓/○ 모양이 색과 별개로 구분을 주지만 그 글리프는
                         * `aria-hidden`이고 라벨 문자열("8자 이상")은 충족 여부와
                         * 무관하게 같다. 충족 여부를 텍스트로도 실어야 스크린리더
                         * 사용자가 무엇이 모자란지 안다.
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
