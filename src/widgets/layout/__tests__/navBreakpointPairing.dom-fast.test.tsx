import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 데스크톱 내비(`Header.tsx`)와 햄버거(`HeaderMobileMenu.tsx`)는 **정확히 반대되는
 * 같은 브레이크포인트**를 써야 한다. 어긋나면 어떤 폭에서 두 내비가 동시에 보이거나
 * 둘 다 사라지는데, 렌더 테스트는 jsdom에 실제 미디어쿼리가 없어 이걸 못 잡는다.
 * 그래서 소스의 유틸리티 클래스를 직접 고정한다.
 *
 * `lg`인 이유: 내비 라벨에 시장("미국")이 붙어 폭이 늘었고, `md`(768px)에 두면
 * 768~896px에서 한글이 글자 단위로 줄바꿈돼 링크가 56px 헤더 밖으로 나간다
 * (768px 실측: 링크 높이 82px, top -12).
 */
const layoutDir = join(process.cwd(), 'src/widgets/layout');
const read = (f: string) => readFileSync(join(layoutDir, f), 'utf8');

describe('헤더 내비 브레이크포인트', () => {
    it('데스크톱 내비는 lg 이상에서만 보인다', () => {
        expect(read('Header.tsx')).toContain(
            'className="hidden shrink-0 lg:flex"'
        );
    });

    it('햄버거는 lg 미만에서만 보인다', () => {
        expect(read('HeaderMobileMenu.tsx')).toContain('className="lg:hidden"');
    });

    it('두 브레이크포인트가 같은 접두를 쓴다', () => {
        const desktop = read('Header.tsx').match(
            /hidden (?:shrink-0 )?(\w+):flex/
        )?.[1];
        const mobile = read('HeaderMobileMenu.tsx').match(
            /"(\w+):hidden"/
        )?.[1];
        expect(desktop).toBeDefined();
        expect(mobile).toBe(desktop);
    });
});

/**
 * 폰 폭에서는 헤더 한 줄에 아이콘이 다 서지 못해 테마 토글이 드로어로 옮겨 간다(`Header.tsx`의
 * "폭 예산"). 헤더가 숨기는 경계와 드로어가 보이는 경계가 어긋나면 어느 쪽에도 토글이 없는 폭이
 * 생기는데, jsdom에는 미디어쿼리가 없어 렌더 테스트로는 못 잡는다. 회원의 언어 전환을 숨기는
 * `globals.css` 규칙도 같은 경계를 쓴다.
 */
describe('폰 폭 헤더 예산 — 헤더와 드로어의 경계', () => {
    const header = read('Header.tsx');
    const drawer = read('HeaderMobileMenu.tsx');
    const css = readFileSync(
        join(process.cwd(), 'src/app/globals.css'),
        'utf8'
    );

    const headerHidesBelow = header.match(
        /HIDE_BELOW_PHONE_BAR = 'max-\[([\d.]+rem)\]:hidden'/
    )?.[1];

    it('헤더는 테마 토글을 그 경계 미만에서 숨긴다', () => {
        expect(headerHidesBelow).toBe('30rem');
        expect(header).toMatch(
            /<div className=\{HIDE_BELOW_PHONE_BAR\}>\s*<ThemeToggle \/>/
        );
    });

    it('드로어는 같은 경계 미만에서만 테마 토글을 보인다', () => {
        const drawerShowsBelow = drawer.match(
            /<div className="min-\[([\d.]+rem)\]:hidden">\s*<ThemeToggle \/>/
        )?.[1];
        expect(drawerShowsBelow).toBe(headerHidesBelow);
    });

    it('회원의 헤더 언어 전환도 같은 경계 미만에서 숨긴다', () => {
        const rule = css.match(
            /@media \(width < ([\d.]+rem)\) \{\s*:root\[data-auth-hint='member'\] \[data-header-locale\] \{\s*display: none;/
        )?.[1];
        expect(rule).toBe(headerHidesBelow);
        expect(header).toContain('data-header-locale=""');
    });

    it('드로어에는 언어 전환이 항상 있다 — 헤더에서 숨겨도 닿을 수 있다', () => {
        expect(drawer).toContain('<LocaleSwitcher showLabel align="start" />');
    });
});
