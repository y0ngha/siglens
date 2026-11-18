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
 * 언어·테마 설정의 집은 **계정 영역**이다 — 비회원은 文A·◐ 버튼(`HeaderPreferencesMenu`), 회원은
 * 아바타 메뉴의 두 줄(`PreferencesSection`). 헤더 줄(`Header.tsx`)에 별도 스위처가 다시 생기면 폰
 * 폭 예산이 깨진다.
 *
 * 예외 하나: 폰 폭에서는 비회원의 ◐가 헤더 줄에서 빠지고 드로어로 간다. 헤더가 숨기는 경계와
 * 드로어가 보이는 경계가 어긋나면 어느 쪽에도 테마가 없는 폭이 생기는데, jsdom에는 미디어쿼리가
 * 없어 렌더 테스트로는 못 잡는다 — 두 쪽이 같은 상수 파일을 쓰는지와 그 값을 고정한다.
 */
describe('언어·테마 설정의 위치와 폰 폭 경계', () => {
    const breakpoints = read('utils/phoneBarBreakpoint.ts');
    const hideBelow = breakpoints.match(
        /HIDE_BELOW_PHONE_BAR = 'max-\[([\d.]+rem)\]:hidden'/
    )?.[1];
    const showBelow = breakpoints.match(
        /SHOW_BELOW_PHONE_BAR = 'min-\[([\d.]+rem)\]:hidden'/
    )?.[1];

    it('헤더가 ◐를 숨기는 경계와 드로어가 테마를 보이는 경계가 같다', () => {
        expect(hideBelow).toBe('30rem');
        expect(showBelow).toBe(hideBelow);
    });

    it('비회원 헤더는 ◐ 버튼만 그 경계로 감싼다', () => {
        expect(read('HeaderPreferencesMenu.tsx')).toMatch(
            /<div className=\{HIDE_BELOW_PHONE_BAR\}>\s*<PreferencePopover\s+icon=\{<ContrastIcon/
        );
    });

    it('드로어의 테마는 비회원에게만, 같은 경계 미만에서만 보인다', () => {
        const drawer = read('HeaderMobileMenu.tsx');
        expect(drawer).toMatch(/\{showAuthCta && \(/);
        expect(drawer).toContain('SHOW_BELOW_PHONE_BAR');
        expect(drawer).toContain('<ThemeRadioGroup');
        expect(drawer).not.toMatch(/LocaleRadioGroup|PreferencesSection/);
    });

    it('회원 아바타 메뉴가 언어·테마 두 줄을 담는다', () => {
        expect(read('ui/user-menu/UserMenuPanel.tsx')).toContain(
            '<PreferencesSection'
        );
    });

    it('헤더 줄(Header.tsx)은 언어·테마 컨트롤을 직접 그리지 않는다', () => {
        expect(read('Header.tsx')).not.toMatch(
            /PreferencesSection|PreferencePopover|LocaleRadioGroup|ThemeRadioGroup/
        );
    });
});
