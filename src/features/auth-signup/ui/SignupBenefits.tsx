import { useLocale, useTranslations } from 'next-intl';
import { REASONING_FEATURE_LABEL_KEY } from '@/features/reasoning-toggle/model/reasoningFeature';
import { resolveLocale } from '@/shared/i18n/locales';
import { timeframeLabel } from '@/shared/lib/timeframeLabel';
import { CheckIcon } from '@/shared/ui/StrokeIcons';
import { signupBenefits, type SignupBenefit } from '../lib/signupBenefits';

const HEADING_ID = 'signup-benefits-heading';

/**
 * 가입 화면의 "회원 혜택" 목록. 서버 컴포넌트라 크롤러와 JS 없는 환경의 HTML에도 실린다.
 * 항목은 등급 설정에서 계산하므로(`signupBenefits`) 무료와 차이가 없어진 항목은 저절로 빠진다.
 * 숫자와 이름은 모두 ICU 인자로 넣는다. 목록이 비면 아무것도 그리지 않는다.
 */
export function SignupBenefits() {
    const t = useTranslations('features.auth-signup.SignupBenefits');
    const tReasoning = useTranslations('features.reasoning-toggle.a11y');
    const locale = resolveLocale(useLocale());

    const benefits = signupBenefits();
    if (benefits.length === 0) return null;

    function text(benefit: SignupBenefit): string {
        switch (benefit.kind) {
            case 'timeframes':
                return t('timeframes', {
                    from: timeframeLabel(benefit.from, locale),
                    to: timeframeLabel(benefit.to, locale),
                });
            case 'detail':
                return t('detail', {
                    feature: tReasoning(REASONING_FEATURE_LABEL_KEY),
                });
            case 'models':
                return t('models', { count: benefit.count });
            case 'emailReport':
                return t('emailReport');
        }
    }

    return (
        <section aria-labelledby={HEADING_ID} className="mb-6">
            <h2
                id={HEADING_ID}
                className="mb-2 text-sm font-semibold text-secondary-100"
            >
                {t('heading')}
            </h2>
            <ul className="space-y-2 text-sm text-secondary-300">
                {benefits.map(benefit => (
                    <li key={benefit.kind} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary-400" />
                        <span className="min-w-0 wrap-anywhere">
                            {text(benefit)}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
