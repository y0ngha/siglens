import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SYMBOL_NAMES_TTL_SECONDS } from '@/app/[locale]/symbols/loadSymbolNames';

/**
 * 페이지의 `revalidate`와 이름 캐시 TTL은 같은 주기여야 한다.
 *
 * 둘이 어긋나면 어긋난 만큼 화면이 거짓말을 한다: 캐시 TTL이 더 길면 페이지는
 * 재생성되는데 이름은 옛 값이고, 더 짧으면 이름을 새로 읽어도 페이지가 안 바뀐다.
 *
 * `revalidate`를 상수로 import할 수 없어 리터럴로 적는다 — Next가 이 값을 **정적으로
 * 분석**하고, import한 식별자는 그 분석을 통과하지 못해 라우트의 ISR이 조용히 꺼진다.
 * 그래서 소스를 읽어 대조한다.
 */
describe('/symbols revalidate parity', () => {
    it('페이지 revalidate 리터럴이 이름 캐시 TTL과 같다', () => {
        const source = readFileSync(
            join(process.cwd(), 'src/app/[locale]/symbols/page.tsx'),
            'utf8'
        );

        const match = /export const revalidate = (\d+);/.exec(source);
        expect(
            match,
            'page.tsx에 revalidate 리터럴이 있어야 한다'
        ).not.toBeNull();
        expect(Number(match![1])).toBe(SYMBOL_NAMES_TTL_SECONDS);
    });
});
