import type { Locale } from '@/shared/i18n/locales';
import type { SeoAnalysisSnapshot, SeoSnapshotTab } from '../model';

/**
 * 페이지 로케일과 **같은 언어로 구워진** 탭 스냅샷만 돌려준다.
 *
 * 프리웜은 한국어로만 굽고, 저장소 `findBySymbol`은 의도적으로 en→ko로 폴백한다
 * (`CONTENT_LOCALE_FALLBACK` — 색인 게이트와 행 존재 판정이 그 폴백에 기대고 있다).
 * 그래서 `/en/NVDA`가 받은 행의 `locale`이 `ko`일 수 있는데, 그 본문을 그대로 그리면
 * 영문 페이지 한가운데 "지난 AI 분석" 한국어 산문이 박힌다. 렌더·JSON-LD·description에
 * 쓰는 행은 이 함수를 거쳐 다른 언어 행을 버린다(섹션 자체를 생략). 비-ko 로케일은
 * noindex라 폴백이 막아 주던 색인 판정에는 영향이 없다.
 */
export function findSnapshotForLocale(
    snapshots: readonly SeoAnalysisSnapshot[] | null | undefined,
    tab: SeoSnapshotTab,
    locale: Locale
): SeoAnalysisSnapshot | undefined {
    return (snapshots ?? []).find(s => s.tab === tab && s.locale === locale);
}
