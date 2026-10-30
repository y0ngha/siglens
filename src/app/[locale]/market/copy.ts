import type { DashboardScopeId } from '@/shared/config/dashboardScope';
import { clampSeoDescription, type SeoTranslator } from '@/shared/lib/seo';

/**
 * 시장별 `/market` 라우트 카피 — 메타데이터·h1·JSON-LD의 단일 소스.
 *
 * 두 라우트가 같은 구조를 그리고 문장만 다르므로, 라우트마다 복사하면 한쪽만
 * 갱신된다. 특히 `title`은 h1과 metadata.title, JSON-LD `name`에 동시에 쓰인다.
 */
export interface MarketCopy {
    readonly path: string;
    /** Root layout이 브랜드 접미사(ko `| 시그렌즈`, 그 외 `| SIGLENS`)를 붙이므로 브랜드명을 넣지 않는다. */
    readonly title: string;
    readonly description: string;
    /** 루트 레이아웃이 `ROOT_KEYWORDS`를 이미 선언하므로 여기엔 페이지 고유 목록(ko 전용)만 둔다. */
    readonly keywords: readonly string[];
    /** breadcrumb 마지막 마디. */
    readonly breadcrumb: string;
    /** ItemList 구조화데이터의 이름. */
    readonly itemListName: string;
}

/**
 * scope의 카피를 현재 로케일 번역자로 만든다(서버 전용 — 메타데이터와 서버 본문이 부른다).
 * `kr`이 아니면 미국 카피다 — 이 라우트들은 `us`·`kr` scope만 넘긴다.
 * `title`/`description`/`breadcrumb`/`itemListName`은 `shared.seo` 카탈로그에서 오고,
 * `keywords`/`path`는 ko 전용 데이터라 리터럴이다.
 */
export function marketCopyFor(
    scope: DashboardScopeId,
    t: SeoTranslator
): MarketCopy {
    return scope === 'kr'
        ? {
              path: '/market/kr',
              title: t('market.kr.title'),
              // clampSeoDescription으로 SEO_DESCRIPTION_MAX_LENGTH를 출력단에서 강제한다 —
              // SERP 절단 방지 + 번역 텍스트 길이 drift 차단.
              description: clampSeoDescription(t('market.kr.description')),
              keywords: [
                  '코스피 오늘',
                  '코스닥 오늘',
                  '한국 주식 시장 개요',
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
                  '미국 주식 시장 개요',
                  '오늘의 종목',
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
