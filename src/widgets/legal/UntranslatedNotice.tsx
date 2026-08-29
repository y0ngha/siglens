import { useTranslations } from 'next-intl';
import { LOCALE_NATIVE_LABEL, type Locale } from '@/shared/i18n/locales';

interface UntranslatedNoticeProps {
    /** 사용자가 요청한 로케일. */
    requested: Locale;
    /** 실제로 본문을 제공한 로케일. */
    served: Locale;
}

/**
 * "이 문서는 아직 번역되지 않았습니다" 안내.
 *
 * 약관·개인정보처리방침 전용이다. 번역이 없어 다른 언어 원문을 보여줄 때
 * **사용자가 그 사실을 알아야 한다** — 모르면 읽지 못하는 문서에 동의하게
 * 되고, 그건 표시 결함이 아니라 법적 문제다.
 *
 * 언어 이름은 `LOCALE_NATIVE_LABEL`(자국어 표기)을 쓴다. "한국어"라고 써 놓고
 * 정작 한국어를 못 읽는 사용자에게 보여주면 안내가 안내 구실을 못 한다.
 */
export function UntranslatedNotice({
    requested,
    served,
}: UntranslatedNoticeProps) {
    const t = useTranslations('widgets.legal');
    return (
        <div
            role="note"
            aria-label={t('untranslatedNoticeLabel')}
            className="my-8 rounded-lg border border-ui-warning/30 bg-ui-warning/5 p-4"
        >
            <p className="text-sm leading-relaxed text-secondary-200">
                {t('untranslatedNotice', {
                    v0: LOCALE_NATIVE_LABEL[requested],
                    v1: LOCALE_NATIVE_LABEL[served],
                })}
            </p>
        </div>
    );
}
