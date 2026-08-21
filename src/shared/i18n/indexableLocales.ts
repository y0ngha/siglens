import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * **종목 페이지**(`/[symbol]/*`)를 색인 가능한 로케일.
 *
 * 종목 페이지의 본문 대부분은 AI 분석 산문이고, 그 산문은 지금 한국어로만
 * 생성된다(core가 프롬프트·캐시키를 소유하며 로케일 파라미터가 없다).
 * 번역 레이어가 붙기 전까지 `/en/AAPL`은 영어 UI 껍데기 안에 **한국어 본문**을
 * 담게 되는데, 그 상태로 색인되면 2026-07의 thin-content 노출 붕괴가
 * 세 개 언어로 재현된다.
 *
 * 그래서 기본값은 기본 로케일 하나다. 분석 후처리 번역이 배포되면
 * (설계 §6.3, Phase 3) 여기에 로케일을 추가한다 — 이 상수 하나가
 * `robots` 메타데이터와 hreflang alternates, sitemap alternates를 동시에 움직인다.
 */
export const SYMBOL_INDEXABLE_LOCALES: readonly Locale[] = [DEFAULT_LOCALE];

/**
 * **정적/허브 페이지**를 색인 가능한 로케일.
 *
 * 이쪽 본문은 전부 UI 카탈로그에서 나오므로 번역이 끝나는 즉시 색인해도 된다.
 * 로케일별 카탈로그가 QA 게이트를 통과했는지는 `yarn i18n:verify`가 보장한다.
 */
export const STATIC_INDEXABLE_LOCALES: readonly Locale[] = [DEFAULT_LOCALE];
