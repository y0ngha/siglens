import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **widgets 간 import 금지 가드.**
 *
 * 위젯 하나가 쓰던 훅·컴포넌트를 다른 위젯이 가져다 쓰기 시작하면, 두 위젯이
 * 서로의 내부 구조에 묶인다. 한때 네 개의 엣지(fear-greed→chart, overall→news,
 * agent-chat→layout, market-fear-greed→fear-greed)가 "의도적 예외"로 남아
 * 있었는데, 전부 `shared/`·`entities/`로 승격해 0개가 됐다. 둘 이상의 위젯이
 * 필요로 하는 것은 아래 레이어로 내린다.
 *
 * oxlint의 `no-restricted-imports`는 파일 단위 패턴이라 "자기 슬라이스가 아닌
 * `@/widgets/*`"를 표현하지 못한다(위젯마다 override를 두어야 한다). 그래서
 * 여기서 소스를 직접 훑는다. 위젯 조합은 `views/`·`app/`의 몫이다.
 *
 * 테스트 파일은 제외한다 — `src/widgets/__tests__`의 배선 테스트는 여러 위젯을
 * 일부러 함께 렌더한다.
 */
const WIDGETS_DIR = path.resolve(__dirname, '../../widgets');
const WIDGET_IMPORT = /from\s+'@\/widgets\/([^/']+)\//g;

describe('widgets는 다른 위젯을 import하지 않는다', () => {
    it('프로덕션 위젯 파일의 @/widgets/* import는 자기 슬라이스만 가리킨다', () => {
        const offenders = readdirSync(WIDGETS_DIR, {
            recursive: true,
            encoding: 'utf8',
        })
            .map(rel => rel.split(path.sep).join('/'))
            .filter(
                rel =>
                    /\.tsx?$/.test(rel) &&
                    !/(^|\/)__tests__\//.test(rel) &&
                    !/\.test\.tsx?$/.test(rel)
            )
            .flatMap(rel => {
                const slice = rel.split('/')[0];
                const source = readFileSync(
                    path.join(WIDGETS_DIR, rel),
                    'utf8'
                );
                return [...source.matchAll(WIDGET_IMPORT)]
                    .filter(([, target]) => target !== slice)
                    .map(([, target]) => `src/widgets/${rel} → ${target}`);
            })
            .sort();

        expect(offenders).toEqual([]);
    });

    it('검출 정규식이 다른 슬라이스 import를 잡는다', () => {
        const matches = [
            ...`import { X } from '@/widgets/chart/X';`.matchAll(WIDGET_IMPORT),
        ].map(([, target]) => target);
        expect(matches).toEqual(['chart']);
    });
});
