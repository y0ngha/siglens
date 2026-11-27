import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import type { MailAlertEmailTranslator } from '../templates/mailAlertEmailTypes';

/**
 * 알림 메일 번역자. 발송 cron은 요청 스코프가 없으므로 로케일을 명시한다 — 빠지면 next-intl이 `headers()`로
 * 물러나 정적 렌더가 꺼진다.
 */
export async function getMailAlertEmailTranslator(
    locale: Locale
): Promise<MailAlertEmailTranslator> {
    // next-intl 번역자는 키를 리터럴 유니온으로 좁힌 제네릭 타입이라 문자열 키 시그니처에 바로 대입되지 않는다.
    // 템플릿은 이 네임스페이스의 키만 쓰고, 런타임 호출 형태(`(key, values?) => string`)는 같다.
    return (await getTranslations({
        locale,
        namespace: 'entities.mail-alert.email',
    })) as unknown as MailAlertEmailTranslator;
}

/** 메일 끝에 싣는 투자 면책 고지. 사이트 전체가 쓰는 같은 문장이다. */
export async function getMailAlertDisclaimer(locale: Locale): Promise<string> {
    const t = await getTranslations({ locale, namespace: 'shared.legal' });
    return t('investmentDisclaimer');
}
