import { withoutSsoParam } from '@/widgets/agent-chat/utils/withoutSsoParam';

describe('withoutSsoParam', () => {
    it('sso가 없으면 null — 주소창을 건드리지 않는다', () => {
        expect(withoutSsoParam('/en?q=hi')).toBeNull();
        expect(withoutSsoParam('/')).toBeNull();
    });

    it('sso만 지우고 q·광고 식별자·해시는 보존한다', () => {
        expect(
            withoutSsoParam(
                '/en?q=NVDA%20%EC%96%B4%EB%95%8C%3F&sso=none&gclid=G1&utm_source=google#composer'
            )
        ).toBe(
            '/en?q=NVDA%20%EC%96%B4%EB%95%8C%3F&gclid=G1&utm_source=google#composer'
        );
    });

    it('sso가 유일한 파라미터면 물음표도 남기지 않는다', () => {
        expect(withoutSsoParam('/?sso=none')).toBe('/');
        expect(withoutSsoParam('/c/abc?sso=none#x')).toBe('/c/abc#x');
    });

    it('이름이 sso로 시작할 뿐인 다른 파라미터는 지우지 않는다', () => {
        expect(withoutSsoParam('/?ssox=1&sso=none')).toBe('/?ssox=1');
        expect(withoutSsoParam('/?ssox=1')).toBeNull();
    });

    it('절대 URL을 받아도 같은 출처 상대 경로로 돌려준다', () => {
        expect(
            withoutSsoParam('https://ai.siglens.io/ja?sso=none&gclid=G1')
        ).toBe('/ja?gclid=G1');
    });
});
