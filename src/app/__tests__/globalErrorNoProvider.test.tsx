import { screen } from '@testing-library/react';
import GlobalError from '../global-error';
import { renderWithoutIntl } from '@/shared/test-utils/renderWithoutIntl';

/**
 * `global-error.tsx`는 루트 레이아웃을 대체하므로 `NextIntlClientProvider`가
 * 트리에 없다. 이 테스트는 그 조건을 **재현**한다 — 전역 setup의 프로바이더 래핑을
 * 우회해서, 누군가 이 파일에 `useTranslations`를 다시 넣으면 여기서 깨지게 한다.
 */
describe('GlobalError — 프로바이더 바깥', () => {
    it('i18n 프로바이더 없이 렌더되고 reset 버튼이 살아 있다', () => {
        // html/body를 직접 렌더하므로 컨테이너 경고는 무시하고 존재만 확인한다.
        const reset = vi.fn();
        expect(() =>
            renderWithoutIntl(
                <GlobalError error={new Error('boom')} reset={reset} />
            )
        ).not.toThrow();
        // ko·en 병기 — 로케일을 알 수 없는 자리이므로 둘 다 나와야 한다.
        expect(
            screen.getByRole('button', { name: /다시 시도 \/ Retry/ })
        ).toBeInTheDocument();
    });
});
