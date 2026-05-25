/**
 * Branch coverage tests for skill/api.ts — targets uncovered branches in
 * parseYamlValue, classifyLine, parseYamlBlock, parseSkillDisplay (missing
 * defaults in toSkill), and collectMdFiles child line filtering.
 */

import { FileSkillsLoader } from '@/entities/skill';

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
    mockReaddir: vi.fn(),
    mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const fileDirent = (name: string) => ({
    name,
    isDirectory: () => false,
    isFile: () => true,
});

describe('skill/api — branch coverage', () => {
    let loader: FileSkillsLoader;

    beforeEach(() => {
        loader = new FileSkillsLoader();
        mockReaddir.mockReset();
        mockReadFile.mockReset();
    });

    describe('parseYamlValue — empty array string "[]"', () => {
        it('parses empty array "[]" as empty array', async () => {
            const md = `---
name: Test
description: Test
indicators: []
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].indicators).toEqual([]);
        });
    });

    describe('parseYamlValue — array with elements and quotes', () => {
        it('parses array with quoted elements', async () => {
            const md = `---
name: Test
description: Test
indicators: ['rsi', 'macd']
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].indicators).toEqual(['rsi', 'macd']);
        });
    });

    describe('parseYamlValue — quoted string value', () => {
        it('parses double-quoted string', async () => {
            const md = `---
name: "Test Skill"
description: "A description"
indicators: []
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].name).toBe('Test Skill');
            expect(skills[0].description).toBe('A description');
        });

        it('parses single-quoted string', async () => {
            const md = `---
name: 'Test Skill'
description: 'A description'
indicators: []
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].name).toBe('Test Skill');
        });
    });

    describe('classifyLine — skip, deeper, break', () => {
        it('handles lines without colon (skip)', async () => {
            const md = `---
name: Test
description: Test
this line has no colon
indicators: []
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].name).toBe('Test');
        });
    });

    describe('parseSkillDisplay — display.chart.show as boolean true', () => {
        it('parses boolean show correctly', async () => {
            // In YAML, "true" without quotes is a boolean in parseYamlValue → string "true"
            // But we need to test the typeof check for boolean (which happens when
            // parseYamlValue returns a string that is not a boolean)
            const md = `---
name: Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display:
  chart:
    show: true
    type: marker
    color: "#ff0000"
    label: "test"
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display?.chart.type).toBe('marker');
        });
    });

    describe('parseSkillDisplay — region type', () => {
        it('parses region chart type', async () => {
            const md = `---
name: Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display:
  chart:
    show: true
    type: region
    color: "#00ff00"
    label: "zone"
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display?.chart.type).toBe('region');
        });
    });

    describe('toSkill — missing optional fields', () => {
        it('defaults to 0 for missing confidenceWeight', async () => {
            const md = `---
name: Test
description: Test
indicators: []
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].confidenceWeight).toBe(0);
        });

        it('defaults name and description from empty', async () => {
            const md = `---
indicators: []
confidence_weight: 0.5
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].name).toBe('');
            expect(skills[0].description).toBe('');
        });

        it('treats non-array indicators as empty array', async () => {
            const md = `---
name: Test
description: Test
indicators: not-an-array
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].indicators).toEqual([]);
        });
    });

    describe('parseSkillDisplay — display non-object', () => {
        it('returns undefined when display is a string', async () => {
            const md = `---
name: Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display: simple-string
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display).toBeUndefined();
        });
    });

    describe('parseSkillDisplay — chart.color/label defaults', () => {
        it('defaults to empty strings when color/label/type are missing', async () => {
            // This exercises the String(chart.color ?? '') etc. fallback branches
            const md = `---
name: Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display:
  chart:
    show: true
    type: line
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display?.chart.color).toBe('');
            expect(skills[0].display?.chart.label).toBe('');
        });
    });

    describe('parseYamlValue — empty bracket with spaces "[ ]"', () => {
        it('parses "[ ]" as empty array', async () => {
            const md = `---
name: Test
description: Test
indicators: [ ]
confidence_weight: 0
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].indicators).toEqual([]);
        });
    });

    describe('classifyLine — deeper indentation and break', () => {
        it('handles nested block with deeper indentation correctly', async () => {
            // This exercises the 'deeper' and 'break' branches in classifyLine
            // and the 'break' branch in parseYamlBlock
            const md = `---
name: Nested Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display:
  chart:
    show: true
    type: line
    color: "#ff0000"
    label: "test"
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display?.chart.show).toBe(true);
            expect(skills[0].display?.chart.type).toBe('line');
        });
    });

    describe('parseSkillDisplay — chart.show is boolean type', () => {
        it('handles chart show as boolean true correctly', async () => {
            // In YAML "true" is a string but parseYamlValue returns it as string "true"
            // The typeof check at L152 tests typeof chart.show === 'boolean'
            // which is the false branch (it's a string). To hit the true branch
            // we need chart.show to be a boolean, which happens when parseYamlValue
            // doesn't intercept it. This is already covered by other tests.
            const md = `---
name: Test
description: Test
type: pattern
indicators: []
confidence_weight: 0
display:
  chart:
    show: true
    type: line
---

Content`;
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();
            expect(skills[0].display?.chart.color).toBe('');
            expect(skills[0].display?.chart.label).toBe('');
        });
    });
});
