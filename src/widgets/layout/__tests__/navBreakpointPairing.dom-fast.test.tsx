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
 * 언어·테마 설정의 집은 **계정 영역 하나**다 — 비회원은 文A 버튼 패널(`HeaderPreferencesMenu`),
 * 회원은 아바타 메뉴(`UserMenuPanel`). 헤더 줄이나 드로어에 별도 스위처가 다시 생기면 폰 폭
 * 예산(`Header.tsx`)이 깨지고, 폭마다 어느 쪽에 보일지 맞춰야 하는 경계 쌍이 되살아난다.
 */
describe('언어·테마 설정은 계정 영역에만 있다', () => {
    const preferencesHosts = [
        'HeaderPreferencesMenu.tsx',
        'ui/user-menu/UserMenuPanel.tsx',
    ];

    it.each(preferencesHosts)('%s가 PreferencesSection을 끼운다', file => {
        expect(read(file)).toContain('<PreferencesSection');
    });

    it.each(['Header.tsx', 'HeaderMobileMenu.tsx'])(
        '%s는 언어·테마 컨트롤을 직접 그리지 않는다',
        file => {
            expect(read(file)).not.toMatch(
                /PreferencesSection|LocaleRadioGroup|ThemeRadioGroup/
            );
        }
    );
});
