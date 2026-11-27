import { TIER_CONFIG, type TierConfig } from '@y0ngha/siglens-core';
import { signupBenefits } from '@/features/auth-signup/lib/signupBenefits';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

/** 가입 회원 등급이 무료와 모든 면에서 같은 설정. 항목이 하나도 없어야 한다. */
const IDENTICAL: TierConfig = {
    ...TIER_CONFIG,
    timeframes: {
        free: TIER_CONFIG.timeframes.free,
        member: TIER_CONFIG.timeframes.free,
        pro: TIER_CONFIG.timeframes.free,
    },
    infoDepth: {
        free: TIER_CONFIG.infoDepth.free,
        member: TIER_CONFIG.infoDepth.free,
        pro: TIER_CONFIG.infoDepth.free,
    },
    models: {
        free: TIER_CONFIG.models.free,
        member: TIER_CONFIG.models.free,
        pro: TIER_CONFIG.models.free,
    },
};

describe('signupBenefits', () => {
    it('실제 등급 설정에서 네 항목을 화면 순서대로 돌려준다', () => {
        expect(signupBenefits()).toEqual([
            { kind: 'timeframes', from: '5Min', to: '1Week' },
            { kind: 'detail' },
            { kind: 'models', count: 5 },
            { kind: 'emailReport' },
        ]);
    });

    it('어떤 항목도 하루 사용 한도를 약속하지 않는다(한도는 등급 간 차이가 없다)', () => {
        // 항목 종류는 네 가지뿐이고, 그 어느 것도 사용량·한도 문구가 아니다.
        const kinds = signupBenefits().map(benefit => benefit.kind);
        expect(kinds).toEqual([
            'timeframes',
            'detail',
            'models',
            'emailReport',
        ]);
        // 실제 카탈로그 문구에도 한도·무제한 표현이 없다.
        const catalog = JSON.stringify(
            MESSAGE_CATALOGS.ko.features['auth-signup'].SignupBenefits
        );
        ['한도', '무제한', '횟수', '하루'].forEach(word => {
            expect(catalog).not.toContain(word);
        });
    });

    it('core가 회원 등급에 열어 둔 주기라도 siglens 화면 목록(TIMEFRAMES) 밖이면 범위에 넣지 않는다', () => {
        const [first] = signupBenefits({
            ...TIER_CONFIG,
            timeframes: {
                ...TIER_CONFIG.timeframes,
                member: [...TIER_CONFIG.timeframes.member, '1Month' as never],
            },
        });
        expect(first).toEqual({
            kind: 'timeframes',
            from: '5Min',
            to: '1Week',
        });
    });

    it('시간 프레임이 무료와 같으면 시간 프레임 항목이 없다', () => {
        const kinds = signupBenefits({
            ...TIER_CONFIG,
            timeframes: IDENTICAL.timeframes,
        }).map(b => b.kind);
        expect(kinds).not.toContain('timeframes');
        expect(kinds).toContain('detail');
    });

    it('분석 상세 항목이 무료와 같으면 상세 분석 항목이 없다', () => {
        const kinds = signupBenefits({
            ...TIER_CONFIG,
            infoDepth: IDENTICAL.infoDepth,
        }).map(b => b.kind);
        expect(kinds).not.toContain('detail');
    });

    it('분석 상세 제한이 꺼져 있으면(무료도 전부 볼 수 있어) 상세 분석 항목이 없다', () => {
        const kinds = signupBenefits({
            ...TIER_CONFIG,
            featureFlags: {
                ...TIER_CONFIG.featureFlags,
                enableInfoDepthRestrictions: false,
            },
        }).map(b => b.kind);
        expect(kinds).not.toContain('detail');
    });

    it('시간 프레임 제한이 꺼져 있으면 시간 프레임 항목이 없다', () => {
        const kinds = signupBenefits({
            ...TIER_CONFIG,
            featureFlags: {
                ...TIER_CONFIG.featureFlags,
                enableTimeframeRestrictions: false,
            },
        }).map(b => b.kind);
        expect(kinds).not.toContain('timeframes');
    });

    it('로그인해야 쓰는 모델이 없으면 모델 항목이 없다', () => {
        const kinds = signupBenefits({
            ...TIER_CONFIG,
            models: IDENTICAL.models,
        }).map(b => b.kind);
        expect(kinds).not.toContain('models');
    });

    it('모델 수는 로그인 전용 모델만 센다', () => {
        const models = signupBenefits().find(b => b.kind === 'models');
        expect(models).toEqual({ kind: 'models', count: 5 });
    });

    it('무료 등급도 메일 리포트를 받으면 메일 리포트는 혜택이 아니다', () => {
        const kinds = signupBenefits(TIER_CONFIG, [
            'free',
            'member',
            'pro',
        ]).map(b => b.kind);
        expect(kinds).not.toContain('emailReport');
    });

    it('가입 회원 등급이 메일 리포트 대상이 아니면 항목이 없다', () => {
        const kinds = signupBenefits(TIER_CONFIG, ['pro']).map(b => b.kind);
        expect(kinds).not.toContain('emailReport');
    });

    it('모든 항목이 같으면 빈 목록이다', () => {
        expect(signupBenefits(IDENTICAL, ['free', 'member'])).toEqual([]);
    });
});
