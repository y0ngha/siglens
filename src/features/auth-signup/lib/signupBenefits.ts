import {
    getAllowedTimeframes,
    getModelAccess,
    isInfoDepthAllowed,
    isTimeframeAllowed,
    TIER_CONFIG,
    type Tier,
    type TierConfig,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { SIGNED_UP_USER_TIER } from '@/entities/auth/lib/authUseCaseConstants';
import { EMAIL_REPORT_TIERS } from '@/entities/email-report/lib/emailReportConstants';

/**
 * 가입 화면의 "회원 혜택" 한 줄. 판별 유니언이라 줄마다 문구에 필요한 값만 싣는다.
 * 하루 사용 한도는 등급 간 차이가 없어(`TIER_CONFIG.limits`) 일부러 항목이 없다.
 */
export type SignupBenefit =
    | {
          readonly kind: 'timeframes';
          readonly from: Timeframe;
          readonly to: Timeframe;
      }
    | { readonly kind: 'detail' }
    | { readonly kind: 'models'; readonly count: number }
    | { readonly kind: 'emailReport' };

/** 회원 등급이 무료(비회원) 등급과 다른 시간 프레임의 범위. 같으면 `null`. */
function timeframesBenefit(
    config: TierConfig,
    signedUpTier: Tier
): SignupBenefit | null {
    // 1Week는 core가 회원 등급에 열어 두었지만 화면(차트·분석 탭, 라벨)이 아직 주봉을 내놓지 않는다.
    // 가입 혜택 문구가 화면에 없는 기능을 약속하지 않도록 뺀다. 주봉 UI가 열릴 때 이 필터를 없앤다.
    const extra = getAllowedTimeframes(signedUpTier, config).filter(
        timeframe =>
            timeframe !== '1Week' &&
            !isTimeframeAllowed('free', timeframe, config)
    );
    const [from] = extra;
    const to = extra.at(-1);
    if (from === undefined || to === undefined) return null;
    return { kind: 'timeframes', from, to };
}

/**
 * 회원만 더 보는 분석 항목이 있는지. '상세 분석' 토글은 이 설정 말고도 클라이언트에서
 * `tier !== 'free'`로 한 번 더 막힌다(`features/symbol-model/hooks/useEffectiveReasoning.ts`).
 * 가입 회원 등급은 member라 두 조건이 같이 열리지만, 둘은 별개의 게이트다.
 */
function detailBenefit(
    config: TierConfig,
    signedUpTier: Tier
): SignupBenefit | null {
    const hasExtraDepth = config.infoDepth[signedUpTier].some(
        depth =>
            isInfoDepthAllowed(signedUpTier, depth, config) &&
            !isInfoDepthAllowed('free', depth, config)
    );
    return hasExtraDepth ? { kind: 'detail' } : null;
}

/** 로그인해야 고를 수 있는 모델의 수. */
function modelsBenefit(
    config: TierConfig,
    signedUpTier: Tier
): SignupBenefit | null {
    const count = config.models[signedUpTier].filter(
        model => getModelAccess(model, config) === 'member'
    ).length;
    return count > 0 ? { kind: 'models', count } : null;
}

/** 메일 리포트가 가입한 회원부터 열리는지(무료 등급이 이미 받으면 혜택이 아니다). */
function emailReportBenefit(
    emailReportTiers: readonly Tier[],
    signedUpTier: Tier
): SignupBenefit | null {
    return emailReportTiers.includes(signedUpTier) &&
        !emailReportTiers.includes('free')
        ? { kind: 'emailReport' }
        : null;
}

/**
 * 가입하면 새로 열리는 것을 등급 설정에서 계산한다. 문구가 설정과 어긋나 부풀려지지 않도록
 * 손으로 적은 목록이 아니라 core `TIER_CONFIG`와 같은 판정 함수를 쓰고, 가입 회원 등급이 무료와
 * 실제로 다른 항목만 돌려준다. 순서는 화면 순서다: 시간 프레임, 상세 분석, 모델, 메일 리포트.
 */
export function signupBenefits(
    config: TierConfig = TIER_CONFIG,
    emailReportTiers: readonly Tier[] = EMAIL_REPORT_TIERS,
    signedUpTier: Tier = SIGNED_UP_USER_TIER
): SignupBenefit[] {
    return [
        timeframesBenefit(config, signedUpTier),
        detailBenefit(config, signedUpTier),
        modelsBenefit(config, signedUpTier),
        emailReportBenefit(emailReportTiers, signedUpTier),
    ].flatMap(benefit => (benefit === null ? [] : [benefit]));
}
