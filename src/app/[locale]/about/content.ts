import type { SkillCounts } from '@y0ngha/siglens-core';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SITE_OPERATOR, TERMS_PATH } from '@/shared/lib/legal';
import { GITHUB_URL, SITE_NAME } from '@/shared/lib/seo';

/**
 * `/about` 본문. 약관·개인정보처리방침과 달리 DB가 아니라 코드 상수다 — 법률
 * 검토용 인프라(버전 관리, 발효일 게이트)는 이 페이지에 과하고, 본문이 배포와
 * 함께 바뀌는 편이 오히려 자연스럽다(설계 §결정 참고).
 *
 * 보조지표·캔들 패턴·전략 스킬 개수는 하드코딩하지 않는다 — 홈(`(home)/page.tsx`)이
 * `countSkillFiles()`로 요청 시점에 계산하는 값과 같은 소스를 받아 보간한다. 리뷰에서
 * 잡힌 문제: 예전엔 여기 39/49/60이 리터럴로 박혀 있어 skills 디렉토리가 바뀌어도
 * 이 페이지만 조용히 낡은 숫자를 냈다. 카운트는 정확한 값이라 "이상"/"+" 같은
 * 최솟값 표기는 붙이지 않는다.
 *
 * ko만 채워지면 `resolveAboutContent`가 나머지 로케일에 폴백한다. en은 색인
 * 대상(`STATIC_INDEXABLE_LOCALES`)이라 함께 작성한다.
 */
type AboutMarkdownByLocale = Readonly<Record<typeof DEFAULT_LOCALE, string>> &
    Readonly<Partial<Record<Locale, string>>>;

function buildAboutMarkdown(counts: SkillCounts): AboutMarkdownByLocale {
    return {
        ko: `## Siglens는 무엇인가

${SITE_NAME}는 티커 하나만 입력하면 차트, 펀더멘털, 재무제표, 뉴스, 옵션, 의회 거래, 공포·탐욕 지수를 AI가 한데 모아 분석하는 서비스입니다. 미국 주식, 한국 주식, 암호화폐를 다룹니다. 매매나 주문 기능은 없고, 증권 계좌를 연결하지도 않습니다.

## 누가 만들고 운영하나

${SITE_NAME}는 개인 개발자 ${SITE_OPERATOR.name}가 혼자 개발하고 운영합니다. 문의는 [이메일](mailto:${SITE_OPERATOR.email})로, 개발자 정보는 [GitHub 프로필](${SITE_OPERATOR.githubUrl})에서 확인할 수 있습니다. 서비스 저장소는 [공개](${GITHUB_URL})되어 있습니다. 운영비는 광고(Google AdSense)로 충당하며, 증권사·자산운용사와의 제휴나 특정 종목을 홍보하는 대가는 받지 않습니다.

## 분석은 어떻게 만들어지나

시세와 재무 데이터는 Yahoo Finance, Financial Modeling Prep, Polygon에서 가져오고, 한국 종목 마스터 데이터는 공공데이터포털(KRX)을 씁니다. 보조지표 ${counts.indicators}종, 캔들 패턴 ${counts.candlesticks}종, 전략 스킬 ${counts.strategies}종을 먼저 규칙 기반으로 계산한 뒤, 그 계산 결과만 LLM(OpenAI, Anthropic, DeepSeek)에 넘겨 서술을 생성합니다. 생성된 서술은 스키마 검증과 정규화를 거쳐 화면에 나갑니다. LLM의 역할은 계산된 값을 설명하는 것이고, 지표와 신호 자체는 규칙 기반 계산이 결정합니다. 시세는 최대 15분 지연될 수 있습니다.

## 얼마나 자주 갱신되나

검색과 공유에 쓰이는 정적 분석은 매일 미국 증시 마감 후 다시 생성됩니다. 페이지를 열면 누구나 최신 데이터로 분석을 실행할 수 있고, 회원은 더 강한 모델과 추론 옵션을 선택할 수 있습니다.

## 한계

AI가 만든 서술은 사실 오류나 수치 오독을 포함할 수 있습니다. 과거 데이터를 기반으로 하므로 미래를 보장하지 않습니다. 실시간 데이터가 아니며, 개인의 재무 상황을 반영하지 않습니다. 모델이나 프롬프트가 바뀌면 같은 입력에도 다른 서술이 나올 수 있습니다.

## 면책

본 서비스의 분석 정보는 투자 참고용이며, 투자 결정의 책임은 이용자에게 있습니다. 매수·매도를 권유하거나 투자 자문을 제공하지 않습니다. 자세한 내용은 [이용약관](${TERMS_PATH})을 참고해 주세요.

## 문의

문의는 [이메일](mailto:${SITE_OPERATOR.email})로 보내주시거나, 페이지 하단의 문의하기를 이용해 주세요.`,
        en: `## What Siglens Is

${SITE_NAME} lets you enter a single ticker and get an AI-combined analysis of charts, fundamentals, financial statements, news, options, congressional trades, and the fear & greed index. It covers US stocks, Korean stocks, and crypto. There is no trading or order feature, and no brokerage account connection.

## Who Built and Runs It

${SITE_NAME} is built and run alone by independent developer ${SITE_OPERATOR.name}. Reach out by [email](mailto:${SITE_OPERATOR.email}), or see the [GitHub profile](${SITE_OPERATOR.githubUrl}). The service's source code is [public](${GITHUB_URL}). Operating costs are covered by ads (Google AdSense); there is no brokerage or asset-manager affiliation, and no payment is accepted for promoting any security.

## How Each Analysis Is Made

Price and financial data come from Yahoo Finance, Financial Modeling Prep, and Polygon; Korean ticker master data comes from the Korea Public Data Portal (KRX). ${counts.indicators} technical indicators, ${counts.candlesticks} candlestick patterns, and ${counts.strategies} strategy skills are computed with rule-based logic first, and only those computed results are passed to an LLM (OpenAI, Anthropic, DeepSeek) to generate prose. The generated prose is then schema-validated and normalized before it reaches the screen. The LLM's job is to explain the computed values; the indicators and signals themselves are decided by rule-based computation. Prices can lag by up to 15 minutes.

## How Often It Updates

The static analysis used for search and sharing is regenerated daily after the US market closes. Anyone can run an analysis on fresh data by opening a page; members can pick stronger models and reasoning options.

## Limits

AI-generated prose can contain factual errors or misread numbers. It is based on historical data, so it does not guarantee future outcomes. It is not real-time, and it does not account for your personal financial situation. Changing the model or prompt can produce different prose for the same input.

## Disclaimer

The analysis on this service is for reference only; investment decisions are your own responsibility. It does not solicit buying or selling, nor does it provide investment advice. See the [Terms of Service](${TERMS_PATH}) for details.

## Contact

Reach out by [email](mailto:${SITE_OPERATOR.email}), or use the contact link in the footer.`,
    };
}

export interface ResolvedAboutContent {
    readonly body: string;
    readonly bodyLocale: Locale;
    readonly isTranslationFallback: boolean;
}

/**
 * `terms`/`privacy`의 `DrizzleTermsRepository.findActive` 폴백 규약과 같다 —
 * 번역이 없으면 기본 로케일(ko) 원문을 내리고 `isTranslationFallback: true`로
 * 표시해 `UntranslatedNotice`를 띄운다.
 *
 * `counts`는 호출부(`about/page.tsx`)가 홈과 동일하게 `countSkillFiles()`로
 * 계산해 넘긴다 — 이 함수 자체는 그 값의 출처를 모른다.
 */
export function resolveAboutContent(
    locale: Locale,
    counts: SkillCounts
): ResolvedAboutContent {
    const markdown = buildAboutMarkdown(counts);
    const body = markdown[locale];
    if (body !== undefined) {
        return { body, bodyLocale: locale, isTranslationFallback: false };
    }
    return {
        body: markdown[DEFAULT_LOCALE],
        bodyLocale: DEFAULT_LOCALE,
        isTranslationFallback: true,
    };
}
