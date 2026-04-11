import {
    countSkillFiles,
    FileSkillsLoader,
} from '@/infrastructure/skills/loader';
import path from 'node:path';

const mockReaddir = jest.fn();
const mockReadFile = jest.fn();

jest.mock('node:fs/promises', () => ({
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const fileDirent = (name: string) => ({
    name,
    isDirectory: () => false,
    isFile: () => true,
});
const dirDirent = (name: string) => ({
    name,
    isDirectory: () => true,
    isFile: () => false,
});

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
            mockReaddir.mockResolvedValue([fileDirent('test.md')]);
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
                fileDirent('test.md'),
                fileDirent('readme.txt'),
                fileDirent('.DS_Store'),
            ]);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(mockReadFile).toHaveBeenCalledTimes(1);
            expect(skills).toHaveLength(1);
        });

        it('type 필드가 없으면 type이 undefined이다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBeUndefined();
        });

        it('indicators가 빈 배열이면 빈 배열로 변환한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].indicators).toEqual([]);
        });
    });

    describe('하위 디렉토리 재귀 탐색', () => {
        const SKILLS_DIR = path.join(process.cwd(), 'skills');
        const PATTERNS_DIR = path.join(SKILLS_DIR, 'patterns');

        it('하위 디렉토리의 .md 파일을 재귀적으로 읽는다', async () => {
            const skillFile = path.join(PATTERNS_DIR, 'head-and-shoulders.md');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('patterns')]);
                if (dir === PATTERNS_DIR)
                    return Promise.resolve([
                        fileDirent('head-and-shoulders.md'),
                    ]);
                return Promise.resolve([]);
            });
            mockReadFile.mockImplementation((p: string) => {
                if (p === skillFile) return Promise.resolve(VALID_SKILL_MD);
                return Promise.resolve('');
            });

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('테스트 스킬');
        });

        it('루트와 하위 디렉토리의 .md 파일을 모두 수집한다', async () => {
            const rootFile = path.join(SKILLS_DIR, 'root.md');
            const subFile = path.join(PATTERNS_DIR, 'sub.md');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([
                        fileDirent('root.md'),
                        dirDirent('patterns'),
                    ]);
                if (dir === PATTERNS_DIR)
                    return Promise.resolve([fileDirent('sub.md')]);
                return Promise.resolve([]);
            });
            mockReadFile.mockImplementation((p: string) => {
                if (p === rootFile) return Promise.resolve(VALID_SKILL_MD);
                if (p === subFile)
                    return Promise.resolve(SKILL_WITH_CATEGORY_MD);
                return Promise.resolve('');
            });

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(2);
        });

        it('빈 하위 디렉토리는 무시한다', async () => {
            const indicatorsDir = path.join(SKILLS_DIR, 'indicators');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('indicators')]);
                if (dir === indicatorsDir) return Promise.resolve([]);
                return Promise.resolve([]);
            });

            const skills = await loader.loadSkills();

            expect(skills).toEqual([]);
        });
    });

    describe('category 파싱', () => {
        it('category 필드가 있으면 SkillCategory로 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bearish');
        });

        it('category 필드가 없으면 category가 undefined이다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
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
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(invalidCategoryMd);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBeUndefined();
        });

        it('reversal_bullish category를 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_BULLISH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bullish');
        });

        it('continuation_bearish category를 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_CONTINUATION_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('continuation_bearish');
        });
    });

    describe('display 파싱', () => {
        it('중첩 display.chart 필드를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
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
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toBeUndefined();
        });

        it('상승 패턴의 display.chart.color를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_BULLISH_CATEGORY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display?.chart.color).toBe('#26a69a');
        });

        it('continuation 패턴의 display.chart.label을 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_CONTINUATION_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].display?.chart.label).toBe('추세선');
        });
    });

    describe('category와 display를 함께 파싱', () => {
        it('category와 display가 모두 파싱된다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_DISPLAY_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].category).toBe('reversal_bearish');
            expect(skills[0].display).toBeDefined();
            expect(skills[0].display?.chart.type).toBe('line');
        });
    });

    describe('pattern 파싱', () => {
        it('pattern 필드가 있으면 pattern 문자열로 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(SKILL_WITH_PATTERN_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].pattern).toBe('head_and_shoulders');
        });

        it('pattern 필드가 없으면 pattern이 undefined이다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(NO_TYPE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].pattern).toBeUndefined();
        });
    });

    describe('indicator_guide 타입 파싱', () => {
        const INDICATOR_GUIDE_SKILL_MD = `---
name: RSI Signal Guide
description: RSI 시그널 해석 가이드
type: indicator_guide
indicators: [rsi]
confidence_weight: 0.9
---

## Signal Interpretation

- RSI > 70: 과매수 구간`;

        it('type이 indicator_guide이면 indicator_guide로 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('rsi.md')]);
            mockReadFile.mockResolvedValue(INDICATOR_GUIDE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBe('indicator_guide');
        });

        it('indicator_guide type의 name, description, indicators를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('rsi.md')]);
            mockReadFile.mockResolvedValue(INDICATOR_GUIDE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].name).toBe('RSI Signal Guide');
            expect(skills[0].description).toBe('RSI 시그널 해석 가이드');
            expect(skills[0].indicators).toEqual(['rsi']);
        });

        it('indicator_guide type의 confidenceWeight를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('rsi.md')]);
            mockReadFile.mockResolvedValue(INDICATOR_GUIDE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].confidenceWeight).toBe(0.9);
        });

        it('indicator_guide type의 content를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('rsi.md')]);
            mockReadFile.mockResolvedValue(INDICATOR_GUIDE_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].content).toContain('Signal Interpretation');
        });

        it('유효하지 않은 type 값이면 type이 undefined이다', async () => {
            const invalidTypeMd = `---
name: 잘못된 타입
description: 테스트
type: unknown_type
indicators: []
confidence_weight: 0.8
---

내용`;
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(invalidTypeMd);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBeUndefined();
        });
    });

    describe('strategy 타입 파싱', () => {
        const STRATEGY_SKILL_MD = `---
name: 엘리어트 파동
description: 엘리어트 파동 이론 기반 현재 파동 위치 및 목표가 분석
type: strategy
category: neutral
indicators: []
confidence_weight: 0.7
---

## Absolute Rules

Three absolute rules govern all Elliott Wave counts.`;

        it('type이 strategy이면 strategy로 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('elliott-wave.md')]);
            mockReadFile.mockResolvedValue(STRATEGY_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBe('strategy');
        });

        it('strategy type의 name, description, indicators를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('elliott-wave.md')]);
            mockReadFile.mockResolvedValue(STRATEGY_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].name).toBe('엘리어트 파동');
            expect(skills[0].description).toBe(
                '엘리어트 파동 이론 기반 현재 파동 위치 및 목표가 분석'
            );
            expect(skills[0].indicators).toEqual([]);
        });

        it('strategy type의 confidenceWeight를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('elliott-wave.md')]);
            mockReadFile.mockResolvedValue(STRATEGY_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].confidenceWeight).toBe(0.7);
        });

        it('strategy type의 content를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('elliott-wave.md')]);
            mockReadFile.mockResolvedValue(STRATEGY_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].content).toContain('Absolute Rules');
        });

        it('strategies 하위 디렉토리의 strategy 스킬을 재귀적으로 읽는다', async () => {
            const SKILLS_DIR = path.join(process.cwd(), 'skills');
            const STRATEGIES_DIR = path.join(SKILLS_DIR, 'strategies');
            const strategyFile = path.join(STRATEGIES_DIR, 'elliott-wave.md');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('strategies')]);
                if (dir === STRATEGIES_DIR)
                    return Promise.resolve([fileDirent('elliott-wave.md')]);
                return Promise.resolve([]);
            });
            mockReadFile.mockImplementation((p: string) => {
                if (p === strategyFile)
                    return Promise.resolve(STRATEGY_SKILL_MD);
                return Promise.resolve('');
            });

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].type).toBe('strategy');
        });
    });

    describe('candlestick 타입 파싱', () => {
        const CANDLESTICK_SKILL_MD = `---
name: Engulfing Pattern Guide
description: 장악형 캔들 패턴 해석 가이드
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.8
---

## Overview

Engulfing은 2봉 반전 패턴이다.`;

        it('type이 candlestick이면 candlestick으로 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('engulfing.md')]);
            mockReadFile.mockResolvedValue(CANDLESTICK_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].type).toBe('candlestick');
        });

        it('candlestick type의 name, description, indicators를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('engulfing.md')]);
            mockReadFile.mockResolvedValue(CANDLESTICK_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].name).toBe('Engulfing Pattern Guide');
            expect(skills[0].description).toBe('장악형 캔들 패턴 해석 가이드');
            expect(skills[0].indicators).toEqual([]);
        });

        it('candlestick type의 confidenceWeight를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('engulfing.md')]);
            mockReadFile.mockResolvedValue(CANDLESTICK_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].confidenceWeight).toBe(0.8);
        });

        it('candlestick type의 content를 올바르게 파싱한다', async () => {
            mockReaddir.mockResolvedValue([fileDirent('engulfing.md')]);
            mockReadFile.mockResolvedValue(CANDLESTICK_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills[0].content).toContain('Overview');
        });

        it('candlesticks 하위 디렉토리의 candlestick 스킬을 재귀적으로 읽는다', async () => {
            const SKILLS_DIR = path.join(process.cwd(), 'skills');
            const CANDLESTICKS_DIR = path.join(SKILLS_DIR, 'candlesticks');
            const candlestickFile = path.join(CANDLESTICKS_DIR, 'engulfing.md');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('candlesticks')]);
                if (dir === CANDLESTICKS_DIR)
                    return Promise.resolve([fileDirent('engulfing.md')]);
                return Promise.resolve([]);
            });
            mockReadFile.mockImplementation((p: string) => {
                if (p === candlestickFile)
                    return Promise.resolve(CANDLESTICK_SKILL_MD);
                return Promise.resolve('');
            });

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].type).toBe('candlestick');
        });
    });

    describe('support_resistance 타입 파싱', () => {
        const SUPPORT_RESISTANCE_SKILL_MD = `---
name: 피봇 포인트
description: 전일 가격 데이터를 기반으로 당일의 지지/저항 레벨을 자동 산출
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.7
---

## Overview

Pivot Points calculate intraday support and resistance levels.`;

        describe('단일 파일 파싱', () => {
            let skills: Awaited<ReturnType<typeof loader.loadSkills>>;

            beforeEach(async () => {
                mockReaddir.mockResolvedValue([fileDirent('pivot-points.md')]);
                mockReadFile.mockResolvedValue(SUPPORT_RESISTANCE_SKILL_MD);
                skills = await loader.loadSkills();
            });

            it('type이 support_resistance이면 support_resistance로 파싱한다', () => {
                expect(skills[0].type).toBe('support_resistance');
            });

            it('name, description, indicators를 올바르게 파싱한다', () => {
                expect(skills[0].name).toBe('피봇 포인트');
                expect(skills[0].description).toBe(
                    '전일 가격 데이터를 기반으로 당일의 지지/저항 레벨을 자동 산출'
                );
                expect(skills[0].indicators).toEqual([]);
            });

            it('confidenceWeight를 올바르게 파싱한다', () => {
                expect(skills[0].confidenceWeight).toBe(0.7);
            });

            it('content를 올바르게 파싱한다', () => {
                expect(skills[0].content).toContain('Overview');
            });
        });

        it('support-resistance 하위 디렉토리의 support_resistance 스킬을 재귀적으로 읽는다', async () => {
            const SKILLS_DIR = path.join(process.cwd(), 'skills');
            const SR_DIR = path.join(SKILLS_DIR, 'support-resistance');
            const srFile = path.join(SR_DIR, 'pivot-points.md');

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('support-resistance')]);
                if (dir === SR_DIR)
                    return Promise.resolve([fileDirent('pivot-points.md')]);
                return Promise.resolve([]);
            });
            mockReadFile.mockImplementation((p: string) => {
                if (p === srFile)
                    return Promise.resolve(SUPPORT_RESISTANCE_SKILL_MD);
                return Promise.resolve('');
            });

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].type).toBe('support_resistance');
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
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockRejectedValue(
                new Error('EACCES: permission denied')
            );

            await expect(loader.loadSkills()).rejects.toThrow('EACCES');
        });
    });

    describe('frontmatter 파싱 실패', () => {
        it('frontmatter가 없는 파일은 결과에서 제외된다', async () => {
            mockReaddir.mockResolvedValue([
                fileDirent('bad.md'),
                fileDirent('good.md'),
            ]);
            mockReadFile
                .mockResolvedValueOnce('frontmatter 없는 파일입니다')
                .mockResolvedValueOnce(VALID_SKILL_MD);

            const skills = await loader.loadSkills();

            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('테스트 스킬');
        });
    });
});

describe('countSkillFiles', () => {
    const SKILLS_DIR = path.join(process.cwd(), 'skills');

    beforeEach(() => {
        mockReaddir.mockReset();
    });

    it('각 서브디렉토리의 .md 파일 수를 병렬로 카운트한다', async () => {
        mockReaddir.mockImplementation((dir: string) => {
            if (dir === path.join(SKILLS_DIR, 'indicators'))
                return Promise.resolve([
                    fileDirent('rsi.md'),
                    fileDirent('macd.md'),
                    fileDirent('readme.txt'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'candlesticks'))
                return Promise.resolve([fileDirent('engulfing.md')]);
            if (dir === path.join(SKILLS_DIR, 'patterns'))
                return Promise.resolve([
                    fileDirent('head-and-shoulders.md'),
                    fileDirent('double-top.md'),
                    fileDirent('double-bottom.md'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'strategies'))
                return Promise.resolve([fileDirent('fibonacci.md')]);
            if (dir === path.join(SKILLS_DIR, 'support-resistance'))
                return Promise.resolve([
                    fileDirent('pivot-points.md'),
                    fileDirent('fibonacci-retracement.md'),
                ]);
            return Promise.resolve([]);
        });

        const counts = await countSkillFiles();

        expect(counts.indicators).toBe(2);
        expect(counts.candlesticks).toBe(1);
        expect(counts.patterns).toBe(3);
        expect(counts.strategies).toBe(1);
        expect(counts.supportResistance).toBe(2);
    });

    it('서브디렉토리의 .md 파일을 재귀적으로 카운트한다', async () => {
        const indicatorsDir = path.join(SKILLS_DIR, 'indicators');
        const subDir = path.join(indicatorsDir, 'oscillators');

        mockReaddir.mockImplementation((dir: string) => {
            if (dir === indicatorsDir)
                return Promise.resolve([
                    dirDirent('oscillators'),
                    fileDirent('ma.md'),
                ]);
            if (dir === subDir)
                return Promise.resolve([
                    fileDirent('rsi.md'),
                    fileDirent('macd.md'),
                ]);
            return Promise.resolve([]);
        });

        const counts = await countSkillFiles();

        expect(counts.indicators).toBe(3);
    });

    it('readdir가 실패하면 에러를 전파한다', async () => {
        mockReaddir.mockRejectedValue(
            new Error('ENOENT: no such file or directory')
        );

        await expect(countSkillFiles()).rejects.toThrow('ENOENT');
    });
});
