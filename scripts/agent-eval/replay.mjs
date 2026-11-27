#!/usr/bin/env node
// 저장 대화 재생(E1)의 도구 쪽 드라이런: 기록된 도구 호출을 OLD/NEW 실행기에 모두 통과시켜 NEW가 무엇을 더하는지 보여 준다.
// LLM·네트워크·DB를 부르지 않는다(읽기 전용 입력 JSON 하나만 읽는다). LLM 루프는 스크래치 하네스가 `replayTools.mjs`의
// `makeReplayExecutor`를 불러 돌린다.
//
//   node --conditions=react-server --import tsx scripts/agent-eval/replay.mjs <input.json> --out <result.json>
//
// 입력 모양은 README "저장 대화 재생 입력". 출력: 케이스별로 기록된 호출마다 `old`/`new` 결과와 `changed` 여부, 그리고
// 기록과 맞지 않은 호출(`misses`) 수. 종료 코드 0.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeReplayExecutor } from './replayTools.mjs';

const argv = process.argv.slice(2);
const inputPath = argv.find(a => !a.startsWith('--'));
const outIndex = argv.indexOf('--out');
const outPath = outIndex >= 0 ? argv[outIndex + 1] : undefined;
if (!inputPath || !outPath) {
    process.stderr.write(
        'usage: replay.mjs <input.json> --out <result.json>\n'
    );
    process.exit(1);
}

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const results = await Promise.all(
    (input.cases ?? []).map(async caseRecord => {
        const options = {
            holderData: input.holderData ?? {},
            today: caseRecord.today,
        };
        const oldRun = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'old',
        });
        const newRun = makeReplayExecutor(caseRecord, {
            ...options,
            variant: 'new',
        });
        const calls = await caseRecord.recorded.reduce(
            async (previous, call) => {
                const acc = await previous;
                const before = await oldRun.execute(call.name, call.args ?? {});
                const after = await newRun.execute(call.name, call.args ?? {});
                return [
                    ...acc,
                    {
                        name: call.name,
                        args: call.args ?? {},
                        old: before,
                        new: after,
                        changed:
                            JSON.stringify(before) !== JSON.stringify(after),
                    },
                ];
            },
            Promise.resolve([])
        );
        return {
            id: caseRecord.id,
            calls,
            misses: newRun.misses.length,
            enriched: calls.filter(c => c.changed).map(c => c.name),
        };
    })
);
writeFileSync(outPath, JSON.stringify({ results }, null, 2));
results.forEach(r =>
    process.stdout.write(
        `${r.id}: ${r.calls.length} calls, enriched [${r.enriched.join(', ') || '-'}], misses ${r.misses}\n`
    )
);
