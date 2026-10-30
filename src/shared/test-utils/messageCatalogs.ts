import koMessages from '../../../messages/ko.json';
import enMessages from '../../../messages/en.json';
import jaMessages from '../../../messages/ja.json';
import zhMessages from '../../../messages/zh.json';
import type { Locale } from '@/shared/i18n/locales';

/**
 * 로케일별 실제 메시지 카탈로그. 테스트 헬퍼(번역자·프로바이더·요청 설정)가
 * 같은 표를 공유해, 로케일을 추가할 때 한 곳만 고치면 되고 헬퍼끼리 카탈로그가
 * 갈리지 않는다. `Record<Locale, …>`라 로케일 누락은 컴파일 단계에서 잡힌다.
 */
export const MESSAGE_CATALOGS: Record<Locale, typeof koMessages> = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};
