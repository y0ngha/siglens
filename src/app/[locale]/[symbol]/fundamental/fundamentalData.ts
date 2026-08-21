import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import { localizeContentRow } from '@/shared/db/localizeContent';
import {
    CONTENT_FIELD,
    TRANSLATABLE_ENTITY,
} from '@/shared/db/contentTranslationFields';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
// DrizzleProfileDescriptionTranslationRepository lives in api.ts which is server-only;
// import from the deep path to avoid pulling the DB chain into the client barrel.
import { DrizzleProfileDescriptionTranslationRepository } from '@/entities/ticker/api';
// translateCompanyDescription also barrel-excluded — koreanTranslator.ts transitively
// pulls in @anthropic-ai/sdk + openai + @google/genai via @/entities/llm-provider, which
// the barrel is not allowed to leak into 'use client' consumers (TickerAutocomplete etc.).
import { translateCompanyDescription } from '@/entities/ticker/lib/koreanTranslator';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import type {
    FundamentalProfile,
    FundamentalPeerInput,
    FundamentalValuationMetrics,
    FundamentalRatiosInput,
    FundamentalGrowthInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';

// Redis 캐싱(`fundamental:*` 키)·per/psr enrich는 CachedFundamentalProvider
// (getFundamentalDataProvider가 반환)로 이관됐다. 페이지·core 분석 경로가 동일
// provider를 통과해 같은 캐시를 공유한다. 이 파일은 provider 위임 + DB 번역
// (getProfileDescription)만 담당한다.
//
// provider는 호출 시점에 심볼로 고른다 — 한국 종목(`005930.KS`)은 FMP 플랜이 커버하지
// 않아 yahoo 백엔드로 가야 하므로, 모듈 레벨 상수 하나로 고정할 수 없다. 양쪽 provider
// 모두 싱글턴이라 호출마다 인스턴스가 생기지는 않는다.
export const getProfile = (
    symbol: string
): Promise<FundamentalProfile | null> =>
    getFundamentalDataProvider(symbol).getProfile(symbol);

/**
 * 회사 설명을 요청 로케일로 반환한다. `null`이면 호출부가 **영어 원문**을
 * 렌더한다(FMP `profile.description`).
 *
 * 로케일별 동작:
 * - `ko`: DB 조회 → 없으면 AI 번역 후 upsert(심볼당 최초 1회).
 * - 그 외: 사이드카에 **그 로케일 행이 있을 때만** 반환. 없으면 `null`을
 *   돌려 영어 원문이 나가게 한다. 한국어로 폴백하면 안 된다 — `/ja` 방문자에게
 *   영어 원문보다 나쁜 결과이고, 폴백 체인(ja→ja,en,ko)의 `en`이 바로 그 원문이다.
 *
 * 비-ko에서는 AI 번역을 **만들지 않는다**. 영어 원문이 이미 있으므로 번역할
 * 이유가 없고, 만들면 심볼 × 로케일만큼 LLM 비용이 붙는다.
 *
 * `cache()` 래핑 의도: 같은 요청에서 여러 번 조회해도 DB lookup·번역을 1회로 묶는다.
 */
export const getProfileDescription = cache(
    async (symbol: string, locale: Locale): Promise<string | null> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);
        const existing = await repo.findBySymbol(symbol);

        if (locale !== DEFAULT_LOCALE) {
            const localized = await localizeContentRow({
                entity: TRANSLATABLE_ENTITY.profileDescription,
                row: { symbol, descriptionKo: existing?.descriptionKo ?? null },
                locale,
                id: row => row.symbol,
                fields: {
                    description: {
                        field: CONTENT_FIELD.profileDescription.description,
                        legacy: row => ({ ko: row.descriptionKo }),
                    },
                },
            });
            const picked = localized.localized.description;
            // 폴백(요청 로케일이 아닌 값)은 버린다 — 위 주석 참조.
            return picked !== null && picked.locale === locale
                ? picked.value
                : null;
        }

        if (existing !== null) return existing.descriptionKo;

        const profile = await getProfile(symbol);
        if (profile === null || profile.description === null) return null;

        const translated = await translateCompanyDescription(
            profile.description
        );
        if (translated === null) return null;

        await repo.upsert({ symbol, descriptionKo: translated });
        return translated;
    }
);

export const getKeyMetricsTtm = (
    symbol: string
): Promise<FundamentalValuationMetrics | null> =>
    getFundamentalDataProvider(symbol).getKeyMetricsTtm(symbol);

// 페이지 PeersTable은 티커·회사명·시총만 렌더하므로 per/psr enrich가 불필요하다 →
// raw 경로로 위임해 peer valuation fan-out을 제거한다. enriched getStockPeers는
// FactLayer(분석 프롬프트) 전용으로 남는다.
export const getStockPeers = (
    symbol: string
): Promise<FundamentalPeerInput[]> =>
    getFundamentalDataProvider(symbol).getStockPeersRaw(symbol);

export const getRatiosTtm = (
    symbol: string
): Promise<FundamentalRatiosInput | null> =>
    getFundamentalDataProvider(symbol).getRatiosTtm(symbol);

export const getIncomeStatementGrowth = (
    symbol: string
): Promise<FundamentalGrowthInput | null> =>
    getFundamentalDataProvider(symbol).getIncomeStatementGrowth(symbol);

export const getFinancialScores = (
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> =>
    getFundamentalDataProvider(symbol).getFinancialScores(symbol);

export const getCashFlowStatement = (
    symbol: string
): Promise<FundamentalCashFlowInput | null> =>
    getFundamentalDataProvider(symbol).getCashFlowStatement(symbol);

export const getAnalystEstimates = (
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> =>
    getFundamentalDataProvider(symbol).getAnalystEstimates(symbol);

export const getGradesConsensus = (
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> =>
    getFundamentalDataProvider(symbol).getGradesConsensus(symbol);

export const getPriceTargetConsensus = (
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> =>
    getFundamentalDataProvider(symbol).getPriceTargetConsensus(symbol);

export const getPriceTargetSummary = (
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> =>
    getFundamentalDataProvider(symbol).getPriceTargetSummary(symbol);
