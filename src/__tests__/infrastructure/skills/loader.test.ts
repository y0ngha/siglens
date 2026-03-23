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

describe('FileSkillsLoader', () => {
    let loader: FileSkillsLoader;

    beforeEach(() => {
        loader = new FileSkillsLoader();
        mockReaddir.mockReset();
        mockReadFile.mockReset();
    });

    describe('loadSkills', () => {
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

        describe('readdir 에러', () => {
            it('readdir가 실패하면 에러를 전파한다', async () => {
                mockReaddir.mockRejectedValue(
                    new Error('ENOENT: no such file or directory')
                );

                await expect(loader.loadSkills()).rejects.toThrow('ENOENT');
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
});
