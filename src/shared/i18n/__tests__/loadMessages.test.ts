import { loadMessages, pickMessages } from '../loadMessages';
import type { Locale } from '../locales';

describe('loadMessages', () => {
    it('실제 로케일 카탈로그를 로드한다(en.json)', async () => {
        const messages = await loadMessages('en');
        // 파일 자체를 스냅샷하지 않는다 — 실제 카탈로그의 최상위 형태(네임스페이스
        // 객체 트리)만 확인해 extract.mjs 산출물 포맷과 어긋나지 않는지 본다.
        expect(typeof messages).toBe('object');
        expect(messages).not.toEqual({});
    });

    /**
     * 배포 중 아직 만들어지지 않은 로케일 카탈로그가 있어도 페이지가 죽으면
     * 안 된다 — 기본 로케일(ko) 카탈로그로 폴백한다.
     */
    it('존재하지 않는 로케일은 기본 로케일(ko) 카탈로그로 폴백한다', async () => {
        const missing = await loadMessages('xx' as Locale);
        const ko = await loadMessages('ko');
        expect(missing).toEqual(ko);
    });
});

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

    /**
     * 네임스페이스가 리프 값(문자열)을 지나쳐 더 깊이 내려가려 하면(카탈로그
     * 구조와 네임스페이스 설정이 어긋난 경우) `source`가 객체가 아니게 된다.
     * 그 지점에서도 던지지 않고 조용히 건너뛰어야 한다.
     */
    it('네임스페이스가 리프 문자열을 지나 더 깊이 내려가려 하면 조용히 건너뛴다', () => {
        expect(
            pickMessages(CATALOG, ['widgets.layout.localeSwitcher.label.extra'])
        ).toEqual({});
    });
});
