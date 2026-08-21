import {
    clampSeoDescription,
    ROOT_KEYWORDS,
    type SeoTranslator,
} from '@/shared/lib/seo';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * 시장별 `/market` 라우트 카피 — 메타데이터·h1·JSON-LD의 단일 소스.
 *
 * 두 라우트가 같은 구조를 그리고 문장만 다르므로, 라우트마다 복사하면 한쪽만
 * 갱신된다. 특히 `title`은 h1과 metadata.title, JSON-LD `name`에 동시에 쓰인다.
 */
export interface MarketCopy {
    readonly path: string;
    /** Root layout이 `| Siglens`를 붙이므로 브랜드명을 넣지 않는다. */
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    /** breadcrumb 마지막 마디. */
    readonly breadcrumb: string;
    /** ItemList 구조화데이터의 이름. */
    readonly itemListName: string;
}

/**
 * `title`/`description`/`breadcrumb`/`itemListName`은 `shared.seo` 카탈로그에서
 * 온다 — `keywords`/`path`는 설계상 ko 전용 데이터라(§5.1) 그대로 둔다.
 */
export function marketCopyFor(
    scope: DashboardScopeId,
    t: SeoTranslator
): MarketCopy {
    return scope === 'kr'
        ? {
              path: '/market/kr',
              title: t('market.kr.title'),
              // clampSeoDescription으로 SEO_DESCRIPTION_MAX_LENGTH(120자)를 출력단에서
              // 강제 — SERP 절단 방지 + 번역 텍스트 길이 drift 차단(MISTAKES §15).
              description: clampSeoDescription(t('market.kr.description')),
              keywords: [
                  ...ROOT_KEYWORDS,
                  '코스피 오늘',
                  '코스닥 오늘',
                  '한국 주식 시장 개요',
                  '오늘 매수 종목',
                  '국내 증시 신호',
                  '반도체 종목',
                  '2차전지 종목',
                  '바이오 종목',
                  '골든크로스 스캐너',
                  'RSI 다이버전스',
                  '볼린저 스퀴즈',
              ],
              breadcrumb: t('market.kr.breadcrumb'),
              itemListName: t('market.kr.itemListName'),
          }
        : {
              path: '/market',
              title: t('market.us.title'),
              // 섹터 개수는 표기하지 않는다(11 GICS ETF + 양자 테마라 단일 숫자가 모호).
              description: clampSeoDescription(t('market.us.description')),
              keywords: [
                  ...ROOT_KEYWORDS,
                  '미국 주식 시장 개요',
                  '오늘의 종목',
                  '오늘 매수 종목',
                  '거래량 급증',
                  '장중 신호',
                  '섹터 ETF 신호',
                  'AI 반도체 종목',
                  '빅테크 종목',
                  '헬스케어 종목',
                  '골든크로스 스캐너',
                  'RSI 다이버전스',
                  '볼린저 스퀴즈',
              ],
              breadcrumb: t('market.us.breadcrumb'),
              itemListName: t('market.us.itemListName'),
          };
}
