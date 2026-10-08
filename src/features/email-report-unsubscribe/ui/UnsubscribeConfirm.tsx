'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { useUnsubscribeEmailReport } from '../hooks/useUnsubscribeEmailReport';

const CONFIRM_BUTTON = cn(BUTTON_PRIMARY, 'h-11 w-full px-4 text-sm');
const LINK =
    'font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 메일 수신거부 확인. 링크를 여는 것만으로는 끄지 않고 버튼을 눌러야 끈다 — 메일
 * 보안 스캐너가 링크를 미리 열어도 수신이 꺼지지 않게 한다.
 *
 * 쿼리는 이 컴포넌트에서만 읽는다(`useSearchParams`) — 페이지는 정적으로 남는다.
 */
export function UnsubscribeConfirm() {
    const t = useTranslations('features.email-report-unsubscribe');
    const params = useSearchParams();
    const userId = params.get('u') ?? '';
    const signature = params.get('sig') ?? '';
    const mutation = useUnsubscribeEmailReport();
    const result = mutation.data;
    const done = result?.status === 'ok';

    if (userId.length === 0 || signature.length === 0) {
        return <ErrorAlert message={t('UnsubscribeConfirm.5b4a51')} />;
    }

    const errorMessage =
        result?.status === 'error'
            ? result.message
            : mutation.isError
              ? t('UnsubscribeConfirm.24d0de')
              : null;

    return (
        <div className="space-y-4">
            <SuccessNotice
                show={done}
                title={t('UnsubscribeConfirm.c13cc8')}
                messages={[t('UnsubscribeConfirm.036dda')]}
            />
            {done ? (
                <p className="text-sm">
                    <Link href="/email-report" className={LINK}>
                        {t('UnsubscribeConfirm.83a2ba')}
                    </Link>
                </p>
            ) : (
                <>
                    {errorMessage !== null ? (
                        <ErrorAlert message={errorMessage} />
                    ) : null}
                    <button
                        type="button"
                        className={CONFIRM_BUTTON}
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ userId, signature })}
                    >
                        {mutation.isPending
                            ? t('UnsubscribeConfirm.24cd06')
                            : t('UnsubscribeConfirm.0fcf72')}
                    </button>
                </>
            )}
        </div>
    );
}
