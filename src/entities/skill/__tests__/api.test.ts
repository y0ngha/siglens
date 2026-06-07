import { countSkillFiles, FileSkillsLoader } from '@/entities/skill';
import type { Skill } from '@y0ngha/siglens-core';
import { dedupeByName, parseGating } from '../api';
import path from 'node:path';

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
                gating: undefined,
                tokenCost: undefined,
                smcFullGuide: false,
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

    describe('display 파싱 — 엣지 케이스', () => {
        it('display.chart.show가 문자열 "false"이면 show=false로 파싱한다', async () => {
            const md = `---
name: 테스트
description: 테스트
type: pattern
indicators: []
confidence_weight: 0.5
display:
  chart:
    show: false
    type: line
    color: "#000"
    label: "test"
---

내용`;
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();

            expect(skills[0].display?.chart.show).toBe(false);
        });

        it('display.chart가 없으면(non-object) display는 undefined', async () => {
            const md = `---
name: 테스트
description: 테스트
type: pattern
indicators: []
confidence_weight: 0.5
display:
  other: value
---

내용`;
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toBeUndefined();
        });

        it('display.chart.type이 유효하지 않으면 display는 undefined', async () => {
            const md = `---
name: 테스트
description: 테스트
type: pattern
indicators: []
confidence_weight: 0.5
display:
  chart:
    show: true
    type: invalid_type
    color: "#000"
    label: "test"
---

내용`;
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toBeUndefined();
        });

        it('display.chart.show가 boolean도 "true"/"false" 문자열도 아니면 display는 undefined', async () => {
            const md = `---
name: 테스트
description: 테스트
type: pattern
indicators: []
confidence_weight: 0.5
display:
  chart:
    show: maybe
    type: line
    color: "#000"
    label: "test"
---

내용`;
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(md);

            const skills = await loader.loadSkills();

            expect(skills[0].display).toBeUndefined();
        });
    });

    describe('ENOENT 서브디렉토리 처리', () => {
        it('skills 서브디렉토리가 없으면 (ENOENT) 빈 배열 반환', async () => {
            const SKILLS_DIR = path.join(process.cwd(), 'skills');
            const enoentError = Object.assign(
                new Error('ENOENT: no such file or directory'),
                { code: 'ENOENT' }
            );

            mockReaddir.mockImplementation((dir: string) => {
                if (dir === SKILLS_DIR)
                    return Promise.resolve([dirDirent('nonexistent')]);
                return Promise.reject(enoentError);
            });

            const skills = await loader.loadSkills();
            expect(skills).toEqual([]);
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

    describe('gating 파싱 (core 로더와 통일)', () => {
        const withGating = (gatingYaml: string, extra = '') => `---
name: 게이팅 스킬
description: 게이팅 테스트
type: indicator_guide
indicators: []
confidence_weight: 0.8
${gatingYaml}${extra}
---

내용`;

        const loadOne = async (md: string) => {
            mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
            mockReadFile.mockResolvedValue(md);
            const skills = await loader.loadSkills();
            return skills[0];
        };

        it('tier: always_on을 파싱한다', async () => {
            const skill = await loadOne(
                withGating('gating:\n  tier: always_on')
            );
            expect(skill.gating).toEqual({ tier: 'always_on' });
        });

        it('gated event(triggers)를 파싱한다', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: event\n  triggers: [rsi_oversold, rsi_overbought]'
                )
            );
            expect(skill.gating).toEqual({
                tier: 'gated',
                signalKind: 'event',
                triggers: ['rsi_oversold', 'rsi_overbought'],
            });
        });

        it('gated state(feature/predicate)를 파싱한다', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: state\n  state:\n    feature: bollinger\n    predicate: pctB'
                )
            );
            expect(skill.gating).toEqual({
                tier: 'gated',
                signalKind: 'state',
                state: { feature: 'bollinger', predicate: 'pctB' },
            });
        });

        it('state predicate의 hi/lo 숫자 임계값을 함께 파싱한다', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: state\n  state:\n    feature: williamsR\n    predicate: level\n    hi: -20\n    lo: -80'
                )
            );
            expect(skill.gating).toEqual({
                tier: 'gated',
                signalKind: 'state',
                state: {
                    feature: 'williamsR',
                    predicate: 'level',
                    hi: -20,
                    lo: -80,
                },
            });
        });

        it('token_cost와 smc_full_guide를 camelCase로 매핑한다', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: always_on',
                    '\ntoken_cost: 850\nsmc_full_guide: true'
                )
            );
            expect(skill.tokenCost).toBe(850);
            expect(skill.smcFullGuide).toBe(true);
        });

        it('따옴표 문자열 smc_full_guide: "true"도 smcFullGuide=true로 매핑한다', async () => {
            // 일부 YAML 저자가 boolean 대신 quoted string 'true'를 쓸 수 있으므로 두 형태 모두 처리하는지 확인
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: always_on',
                    "\nsmc_full_guide: 'true'"
                )
            );
            expect(skill.smcFullGuide).toBe(true);
        });

        it('gating이 없으면 undefined, smcFullGuide는 false이다', async () => {
            const skill = await loadOne(VALID_SKILL_MD);
            expect(skill.gating).toBeUndefined();
            expect(skill.tokenCost).toBeUndefined();
            expect(skill.smcFullGuide).toBe(false);
        });

        it('잘못된 tier는 gating undefined로 fail-open한다', async () => {
            const skill = await loadOne(
                withGating('gating:\n  tier: nonsense')
            );
            expect(skill.gating).toBeUndefined();
        });

        it('gated인데 signal_kind가 유효하지 않으면 gating undefined로 fail-open한다', async () => {
            const skill = await loadOne(
                withGating('gating:\n  tier: gated\n  signal_kind: bogus')
            );
            expect(skill.gating).toBeUndefined();
        });

        it('gated인데 triggers가 비면 unreachable → gating undefined', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: event\n  triggers: []'
                )
            );
            expect(skill.gating).toBeUndefined();
        });

        // The inline-array YAML parser coerces every element to a string, so a
        // non-string trigger can't reach parseGating's guard through loadSkills.
        // Exercise that fail-open branch directly with a raw object instead.
        it('triggers에 비문자열 항목이 섞이면 gating undefined로 fail-open한다', () => {
            expect(
                parseGating({
                    tier: 'gated',
                    signal_kind: 'event',
                    triggers: ['rsi_oversold', 42],
                })
            ).toBeUndefined();
        });

        it('state predicate의 feature가 유효하지 않으면 gating undefined', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: state\n  state:\n    feature: bogus\n    predicate: pctB'
                )
            );
            expect(skill.gating).toBeUndefined();
        });

        it('유효한 feature라도 predicate가 유효하지 않으면 gating undefined로 fail-open한다', async () => {
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: state\n  state:\n    feature: bollinger\n    predicate: bogus_predicate'
                )
            );
            expect(skill.gating).toBeUndefined();
        });

        it('도달 불가능한 (feature, predicate) 쌍은 gating undefined로 fail-open한다', async () => {
            // bollinger + channelProximity: 각 절반은 유효하지만 core의
            // isStateNotable이 절대 평가하지 않는 쌍 → 도달 불가.
            const skill = await loadOne(
                withGating(
                    'gating:\n  tier: gated\n  signal_kind: state\n  state:\n    feature: bollinger\n    predicate: channelProximity'
                )
            );
            expect(skill.gating).toBeUndefined();
        });
    });
});

describe('countSkillFiles', () => {
    const SKILLS_DIR = path.join(process.cwd(), 'skills');

    const skillMd = (name: string, frontmatter: string) => `---
name: ${name}
description: 설명
${frontmatter}
indicators: []
confidence_weight: 0.5
---

## 내용

내용`;

    beforeEach(() => {
        mockReaddir.mockReset();
        mockReadFile.mockReset();
    });

    it('frontmatter의 type/category 기준으로 카운트한다', async () => {
        const files: Record<string, string> = {
            [path.join(SKILLS_DIR, 'indicators/rsi.md')]: skillMd(
                'RSI',
                'type: indicator_guide'
            ),
            [path.join(SKILLS_DIR, 'indicators/macd.md')]: skillMd(
                'MACD',
                'type: indicator_guide'
            ),
            [path.join(SKILLS_DIR, 'candlesticks/engulfing.md')]: skillMd(
                '장악형',
                'type: candlestick'
            ),
            [path.join(SKILLS_DIR, 'patterns/head.md')]: skillMd(
                '헤드앤숄더',
                'type: pattern'
            ),
            [path.join(SKILLS_DIR, 'patterns/double-top.md')]: skillMd(
                '이중천장',
                'type: pattern'
            ),
            [path.join(SKILLS_DIR, 'patterns/double-bottom.md')]: skillMd(
                '이중바닥',
                'type: pattern'
            ),
            [path.join(SKILLS_DIR, 'strategies/fib.md')]: skillMd(
                '피보나치',
                'type: strategy'
            ),
            [path.join(SKILLS_DIR, 'support-resistance/pivot.md')]: skillMd(
                '피봇',
                'type: support_resistance'
            ),
            [path.join(SKILLS_DIR, 'support-resistance/fib-retr.md')]: skillMd(
                '피보나치 되돌림',
                'type: support_resistance'
            ),
            [path.join(SKILLS_DIR, 'fundamental/earnings.md')]: skillMd(
                '실적',
                'category: fundamental'
            ),
            [path.join(SKILLS_DIR, 'news/sentiment.md')]: skillMd(
                '뉴스 센티먼트',
                'category: news'
            ),
            [path.join(SKILLS_DIR, 'news/catalyst.md')]: skillMd(
                '뉴스 촉매',
                'category: news'
            ),
        };

        mockReaddir.mockImplementation((dir: string) => {
            if (dir === SKILLS_DIR)
                return Promise.resolve([
                    dirDirent('indicators'),
                    dirDirent('candlesticks'),
                    dirDirent('patterns'),
                    dirDirent('strategies'),
                    dirDirent('support-resistance'),
                    dirDirent('fundamental'),
                    dirDirent('news'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'indicators'))
                return Promise.resolve([
                    fileDirent('rsi.md'),
                    fileDirent('macd.md'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'candlesticks'))
                return Promise.resolve([fileDirent('engulfing.md')]);
            if (dir === path.join(SKILLS_DIR, 'patterns'))
                return Promise.resolve([
                    fileDirent('head.md'),
                    fileDirent('double-top.md'),
                    fileDirent('double-bottom.md'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'strategies'))
                return Promise.resolve([fileDirent('fib.md')]);
            if (dir === path.join(SKILLS_DIR, 'support-resistance'))
                return Promise.resolve([
                    fileDirent('pivot.md'),
                    fileDirent('fib-retr.md'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'fundamental'))
                return Promise.resolve([fileDirent('earnings.md')]);
            if (dir === path.join(SKILLS_DIR, 'news'))
                return Promise.resolve([
                    fileDirent('sentiment.md'),
                    fileDirent('catalyst.md'),
                ]);
            return Promise.resolve([]);
        });
        mockReadFile.mockImplementation((file: string) =>
            Promise.resolve(files[file] ?? '')
        );

        const counts = await countSkillFiles();

        expect(counts.indicators).toBe(2);
        expect(counts.candlesticks).toBe(1);
        expect(counts.patterns).toBe(3);
        expect(counts.strategies).toBe(1);
        expect(counts.supportResistance).toBe(2);
        expect(counts.fundamental).toBe(1);
        expect(counts.news).toBe(2);
    });

    it('서브디렉토리 외부의 _core/* 스킬도 type 기준으로 합산된다', async () => {
        const files: Record<string, string> = {
            [path.join(SKILLS_DIR, 'indicators/rsi.md')]: skillMd(
                'RSI',
                'type: indicator_guide'
            ),
            [path.join(SKILLS_DIR, '_core/indicator-core.md')]: skillMd(
                '지표 코어',
                'type: indicator_guide'
            ),
            [path.join(SKILLS_DIR, '_core/candle-primer.md')]: skillMd(
                '캔들 프라이머',
                'type: candlestick'
            ),
        };

        mockReaddir.mockImplementation((dir: string) => {
            if (dir === SKILLS_DIR)
                return Promise.resolve([
                    dirDirent('indicators'),
                    dirDirent('_core'),
                ]);
            if (dir === path.join(SKILLS_DIR, 'indicators'))
                return Promise.resolve([fileDirent('rsi.md')]);
            if (dir === path.join(SKILLS_DIR, '_core'))
                return Promise.resolve([
                    fileDirent('indicator-core.md'),
                    fileDirent('candle-primer.md'),
                ]);
            return Promise.resolve([]);
        });
        mockReadFile.mockImplementation((file: string) =>
            Promise.resolve(files[file] ?? '')
        );

        const counts = await countSkillFiles();

        // _core/indicator-core.md가 type=indicator_guide라 indicators에 합산
        expect(counts.indicators).toBe(2);
        // _core/candle-primer.md가 type=candlestick이라 candlesticks에 합산
        expect(counts.candlesticks).toBe(1);
        // 다른 버킷이 누설/오집계되지 않음을 보장
        expect(counts.patterns).toBe(0);
        expect(counts.strategies).toBe(0);
        expect(counts.supportResistance).toBe(0);
        expect(counts.fundamental).toBe(0);
        expect(counts.news).toBe(0);
    });

    it('type과 category가 동시 지정된 스킬은 두 버킷에 독립 집계된다', async () => {
        // byType과 byCategory는 독립 accumulator. category=fundamental + type=pattern인
        // (가상의) 스킬은 patterns에 1, fundamental에 1로 모두 잡혀야 한다.
        // 둘을 합쳐 한쪽만 카운트하는 회귀를 막는다.
        const files: Record<string, string> = {
            [path.join(SKILLS_DIR, 'mixed/hybrid.md')]: skillMd(
                '하이브리드',
                'type: pattern\ncategory: fundamental'
            ),
        };

        mockReaddir.mockImplementation((dir: string) => {
            if (dir === SKILLS_DIR)
                return Promise.resolve([dirDirent('mixed')]);
            if (dir === path.join(SKILLS_DIR, 'mixed'))
                return Promise.resolve([fileDirent('hybrid.md')]);
            return Promise.resolve([]);
        });
        mockReadFile.mockImplementation((file: string) =>
            Promise.resolve(files[file] ?? '')
        );

        const counts = await countSkillFiles();

        expect(counts.patterns).toBe(1);
        expect(counts.fundamental).toBe(1);
        // 다른 버킷에 누설되지 않음
        expect(counts.indicators).toBe(0);
        expect(counts.candlesticks).toBe(0);
        expect(counts.strategies).toBe(0);
        expect(counts.supportResistance).toBe(0);
        expect(counts.news).toBe(0);
    });

    it('non-ENOENT 파일시스템 에러는 전파된다', async () => {
        // collectMdFiles는 .code === 'ENOENT'만 swallow하므로,
        // 다른 코드(예: EACCES)는 그대로 throw되어야 한다.
        // 이전에는 plain Error를 던졌는데, 그 경우 code === undefined !== 'ENOENT'라
        // 우연히 통과해 실제 분기를 검증하지 못했다.
        const error = Object.assign(new Error('EACCES: permission denied'), {
            code: 'EACCES',
        });
        mockReaddir.mockRejectedValue(error);

        await expect(countSkillFiles()).rejects.toThrow('EACCES');
    });
});

describe('usage_roles 파싱 (parseUsageRoles)', () => {
    let loader: FileSkillsLoader;

    const withUsageRoles = (usageRolesYaml: string) => `---
name: 역할 스킬
description: 역할 테스트
type: indicator_guide
indicators: []
confidence_weight: 0.8
${usageRolesYaml}
---

내용`;

    const loadOne = async (md: string) => {
        mockReaddir.mockResolvedValue([fileDirent('skill.md')]);
        mockReadFile.mockResolvedValue(md);
        const skills = await loader.loadSkills();
        return skills[0];
    };

    beforeEach(() => {
        loader = new FileSkillsLoader();
        mockReaddir.mockReset();
        mockReadFile.mockReset();
    });

    it('valid usage_roles [confirmation, signal] → usageRoles 정규 순서 [signal, confirmation]', async () => {
        const skill = await loadOne(
            withUsageRoles('usage_roles: [confirmation, signal]')
        );
        expect(skill.usageRoles).toEqual(['signal', 'confirmation']);
    });

    it('모든 5개 역할 → 정규 순서로 정렬된다', async () => {
        const skill = await loadOne(
            withUsageRoles(
                'usage_roles: [risk, regime, confirmation, measurement, signal]'
            )
        );
        expect(skill.usageRoles).toEqual([
            'signal',
            'confirmation',
            'regime',
            'measurement',
            'risk',
        ]);
    });

    it('알 수 없는 역할이 포함되면 usageRoles === undefined (fail-open)', async () => {
        const skill = await loadOne(
            withUsageRoles('usage_roles: [signal, unknown_role]')
        );
        expect(skill.usageRoles).toBeUndefined();
    });

    it('빈 배열 [] → usageRoles === undefined', async () => {
        const skill = await loadOne(withUsageRoles('usage_roles: []'));
        expect(skill.usageRoles).toBeUndefined();
    });

    it('중복 역할이 있으면 usageRoles === undefined', async () => {
        // The inline YAML parser produces a string[] from [signal, signal];
        // parseUsageRoles must detect the duplicate and return undefined.
        const skill = await loadOne(
            withUsageRoles('usage_roles: [signal, signal]')
        );
        expect(skill.usageRoles).toBeUndefined();
    });

    it('usage_roles 필드 없음 → usageRoles === undefined', async () => {
        const skill = await loadOne(
            withUsageRoles('') // no usage_roles line
        );
        expect(skill.usageRoles).toBeUndefined();
    });

    it('scalar(비배열) usage_roles → usageRoles === undefined', async () => {
        // parseYamlValue returns a string for a bare scalar,
        // so parseUsageRoles receives a non-array → undefined.
        const skill = await loadOne(withUsageRoles('usage_roles: signal'));
        expect(skill.usageRoles).toBeUndefined();
    });
});

describe('dedupeByName', () => {
    const skill = (name: string, description = 'd'): Skill => ({
        name,
        description,
        indicators: [],
        confidenceWeight: 0,
        content: '',
        smcFullGuide: false,
    });

    it('이름 중복 시 첫 번째만 남기고 이후 중복을 제거한다', () => {
        const out = dedupeByName([
            skill('A', 'first'),
            skill('B'),
            skill('A', 'dup'),
            skill('C'),
        ]);
        expect(out.map(s => s.name)).toEqual(['A', 'B', 'C']);
        expect(out[0].description).toBe('first');
    });

    it('빈 입력은 빈 배열을 반환한다', () => {
        expect(dedupeByName([])).toEqual([]);
    });

    it('이름이 모두 고유하면 순서를 유지한 채 그대로 반환한다', () => {
        const out = dedupeByName([skill('A'), skill('B'), skill('C')]);
        expect(out.map(s => s.name)).toEqual(['A', 'B', 'C']);
    });
});
