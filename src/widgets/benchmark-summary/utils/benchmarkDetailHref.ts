/** 벤치마크 상세 페이지 링크 주소. */
import { BENCHMARK_PATH } from '@/shared/config/benchmark';
import { localePath, type Locale } from '@/shared/i18n/locales';

/**
 * 상세 페이지의 정본(ai 호스트)을 가리키는 절대 URL. 두 호스트의 소개 페이지가 같은 곳으로 보내도록
 * 상대 경로를 쓰지 않는다.
 */
export function buildBenchmarkDetailHref(
    aiSiteUrl: string,
    locale: Locale
): string {
    return `${aiSiteUrl}${localePath(locale, BENCHMARK_PATH)}`;
}
