import { FileSkillsLoader } from '@/infrastructure/skills/loader';

const mockReaddir = jest.fn();
const mockReadFile = jest.fn();

jest.mock('node:fs/promises', () => ({
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const VALID_SKILL_MD = `---
name: 테스트 스킬
description: 테스트용 스킬
type: pattern
indicators: [rsi, macd]
confidence_weight: 0.8
---

## 분석 기준

- 테스트 분석 기준`;

const NO_TYPE_SKILL_MD = `---
name: 일반 스킬
description: 일반 스킬
indicators: []
confidence_weight: 0.5
---

## 내용

내용`;

const SKILL_WITH_CATEGORY_MD = `---
name: 헤드앤숄더
description: 하락 반전 신호
type: pattern
category: reversal_bearish
indicators: []
confidence_weight: 0.8
---

## 내용

내용`;

const SKILL_WITH_DISPLAY_MD = `---
name: 이중천장
description: 하락 반전 신호
type: pattern
category: reversal_bearish
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "넥라인"
---

## 내용

내용`;

const SKILL_WITH_BULLISH_CATEGORY_MD = `---
name: 이중바닥
description: 상승 반전 신호
type: pattern
category: reversal_bullish
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: true
    type: line
    color: "#26a69a"
    label: "넥라인"
---

## 내용

내용`;

const SKILL_WITH_CONTINUATION_MD = `---
name: 상승쐐기
description: 하락 반전 신호
type: pattern
category: continuation_bearish
indicators: []
confidence_weight: 0.7
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "추세선"
---

## 내용

내용`;

const SKILL_WITH_PATTERN_MD = `---
name: 헤드앤숄더
description: 하락 반전 신호
type: pattern
category: reversal_bearish
pattern: head_and_shoulders
indicators: []
confidence_weight: 0.8
display:
  chart:
    show: true
    type: line
    color: "#ef5350"
    label: "넥라인"
---

## 내용

내용`;

describe('FileSkillsLoader', () => {
    let loader: FileSkillsLoader;

    beforeEach(() => {
        loader = new FileSkillsLoader();
        mockReaddir.mockReset();
        mockReadFile.mockReset();
    });

    describe('정상 케이스', () => {
        it('skills/ 디렉토리의 .md 파일을 읽어 Skill 배열로 반환한다', async () => {
            mockReaddir.mockResolvedValue(['test.md']);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0]).toEqual({
                name: '테스트 스킬',
                description: '테스트용 스킬',
                type: 'pattern',
                indicators: ['rsi', 'macd'],
                confidenceWeight: 0.8,
                content: '## 분석 기준\n\n- 테스트 분석 기준',
                category: undefined,
                pattern: undefined,
                display: undefined,
            });
        });

        it('skills 디렉토리가 비어있으면 빈 배열을 반환한다', async () => {
            mockReaddir.mockResolvedValue([]);

            const skills = await loader.loadSkills();

            expect(skills).toEqual([]);
        });

        it('.md가 아닌 파일은 무시한다', async () => {
            mockReaddir.mockResolvedValue([
                'test.md',
                'readme.txt',
                '.DS_Store',
            ]);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(mockReadFile).toHaveBeenCalledTimes(1);
            expect(skills).toHaveLength(1);
        });

        it('type 필드가 없으면 type이 undefined이다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBeUndefined();
        });

        it('indicators가 빈 배열이면 빈 배열로 변환한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].indicators).toEqual([]);
        });
    });

    describe('category 파싱', () => {
        it('category 필드가 있으면 SkillCategory로 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bearish');
        });

        it('category 필드가 없으면 category가 undefined이다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBeUndefined();
        });

        it('유효하지 않은 category 값이면 category가 undefined이다', async () => {
            const invalidCategoryMd = `---
name: 잘못된 카테고리
description: 테스트
type: pattern
category: unknown_category
indicators: []
confidence_weight: 0.8
---

내용`;
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(invalidCategoryMd);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBeUndefined();
        });

        it('reversal_bullish category를 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_BULLISH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bullish');
        });

        it('continuation_bearish category를 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_CONTINUATION_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('continuation_bearish');
        });
    });

    describe('display 파싱', () => {
        it('중첩 display.chart 필드를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_DISPLAY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toEqual({
                chart: {
                    show: true,
                    type: 'line',
                    color: '#ef5350',
                    label: '넥라인',
                },
            });
        });

        it('display 필드가 없으면 display가 undefined이다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toBeUndefined();
        });

        it('상승 패턴의 display.chart.color를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_BULLISH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display?.chart.color).toBe('#26a69a');
        });

        it('continuation 패턴의 display.chart.label을 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_CONTINUATION_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display?.chart.label).toBe('추세선');
        });
    });

    describe('category와 display를 함께 파싱', () => {
        it('category와 display가 모두 파싱된다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_DISPLAY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bearish');
            expect(skills[0].display).toBeDefined();
            expect(skills[0].display?.chart.type).toBe('line');
        });
    });

    describe('pattern 파싱', () => {
        it('pattern 필드가 있으면 pattern 문자열로 파싱한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(SKILL_WITH_PATTERN_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].pattern).toBe('head_and_shoulders');
        });

        it('pattern 필드가 없으면 pattern이 undefined이다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].pattern).toBeUndefined();
        });
    });

    describe('readdir 에러', () => {
        it('readdir가 실패하면 에러를 전파한다', async () => {
            mockReaddir.mockRejectedValue(
                new Error('ENOENT: no such file or directory')
            );

            await expect(loader.loadSkills()).rejects.toThrow('ENOENT');
        });
    });

    describe('readFile 에러', () => {
        it('readFile이 실패하면 에러를 전파한다', async () => {
            mockReaddir.mockResolvedValue(['skill.md']);
            mockReadFile.mockRejectedValue(
                new Error('EACCES: permission denied')
            );

            await expect(loader.loadSkills()).rejects.toThrow('EACCES');
        });
    });

    describe('frontmatter 파싱 실패', () => {
        it('frontmatter가 없는 파일은 결과에서 제외된다', async () => {
            mockReaddir.mockResolvedValue(['bad.md', 'good.md']);
            mockReadFile
                .mockResolvedValueOnce('frontmatter 없는 파일입니다')
                .mockResolvedValueOnce(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('테스트 스킬');
        });
    });
});
