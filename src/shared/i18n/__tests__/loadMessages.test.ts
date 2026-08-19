import { pickMessages } from '../loadMessages';

const CATALOG = {
    widgets: {
        layout: { localeSwitcher: { label: '언어 선택' } },
        analysis: { Panel: { a1: '분석' } },
    },
    app: { home: { page: { b2: '홈' } } },
};

describe('pickMessages', () => {
    /**
     * next-intl은 네임스페이스를 `.`로 쪼개 객체를 타고 내려간다. 뽑아낸 결과가
     * 평면 키(`{'widgets.layout': …}`)면 절대 매칭되지 않는다 — 첫 빌드에서
     * `MISSING_MESSAGE: widgets.layout`으로 드러난 실패다.
     */
    it('중첩 구조를 유지한 채 서브트리를 되쌓는다', () => {
        expect(pickMessages(CATALOG, ['widgets.layout'])).toEqual({
            widgets: { layout: { localeSwitcher: { label: '언어 선택' } } },
        });
    });

    it('요청하지 않은 네임스페이스는 클라이언트로 나가지 않는다', () => {
        const picked = pickMessages(CATALOG, ['widgets.layout']);
        expect(picked).not.toHaveProperty('app');
        expect(
            (picked as { widgets: Record<string, unknown> }).widgets
        ).not.toHaveProperty('analysis');
    });

    it('여러 네임스페이스를 한 트리에 병합한다', () => {
        expect(pickMessages(CATALOG, ['widgets.layout', 'app.home'])).toEqual({
            widgets: { layout: { localeSwitcher: { label: '언어 선택' } } },
            app: { home: { page: { b2: '홈' } } },
        });
    });

    it('없는 네임스페이스는 조용히 건너뛴다 — 배포 중 카탈로그 공백이 페이지를 죽이면 안 된다', () => {
        expect(pickMessages(CATALOG, ['widgets.nope'])).toEqual({});
    });
});
