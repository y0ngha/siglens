/**
 * 데모 차트(`GuideDemoChart`)의 대체 설명 문구를 만드는 순수 함수. 번역자·포매터는 컴포넌트가 훅으로 얻어
 * 넘긴다 — ui 파일에 커스텀 훅을 두지 않고, 문구 조립은 실제 카탈로그로 단위 테스트한다.
 */
import type { GuideDemo } from '@/views/guide/demos/types';

type DemoDescriptionKey =
    | 'demoFallbackDescription'
    | 'demoFallbackDescriptionWithPanes';

/**
 * `views.guide` 네임스페이스 번역자 중 이 모듈이 부르는 모양만. next-intl을 import하지 않고 호출부
 * (`useTranslations`/`getTranslations`)가 만든 번역자를 받아, 서버 컴포넌트가 아닌 곳에서도 그대로 테스트한다.
 */
export type DemoDescriptionTranslator = (
    key: DemoDescriptionKey,
    values: Readonly<Record<string, string | number>>
) => string;

/**
 * next-intl 포매터(`useFormatter`/`getFormatter`) 중 패널 이름을 잇는 목록 형식만.
 * next-intl의 `list`는 글자와 React 요소를 함께 받는 제네릭 오버로드라, `(string[]) => string` 같은 단순 시그니처에는
 * 대입되지 않는다. 같은 제네릭 모양을 두되 글자를 넘길 때 `string`이 나오는 부분만 남긴다.
 */
export interface DemoListFormatter {
    readonly list: <Value extends string | object>(
        values: Iterable<Value>,
        options: Intl.ListFormatOptions
    ) => Value extends string ? string : unknown;
}

/**
 * 캡션이 없는 데모 차트의 SVG 설명(`<desc>`) — 봉 수와 보조 패널 이름.
 * 패널 이름은 로케일의 목록 형식(`conjunction`)으로 잇는다. 그래서 "A, B" 같은 구분자를 문구에 박지 않는다.
 *
 * 키를 `t('리터럴')`로 직접 부르는 이유: i18n 추출기가 이 파일의 리터럴 키를 사용 중으로 세야
 * `--write`가 카탈로그에서 키를 지우지 않는다(번역자 변수 이름은 `t`로 시작해야 한다).
 */
export function describeDemo(
    demo: GuideDemo,
    t: DemoDescriptionTranslator,
    format: DemoListFormatter
): string {
    const paneLabels = (demo.panes ?? []).map(pane => pane.label);
    const count = demo.bars.length;
    if (paneLabels.length === 0) return t('demoFallbackDescription', { count });
    return t('demoFallbackDescriptionWithPanes', {
        count,
        panes: format.list(paneLabels, { type: 'conjunction' }),
    });
}
