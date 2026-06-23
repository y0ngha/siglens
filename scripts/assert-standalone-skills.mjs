// 빌드 후 .next/standalone에 skills/ 파일이 포함됐는지 확인.
// outputFileTracingIncludes가 누락하면 런타임 Server Action이 skills를 못 읽는다.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const standaloneSkills = join(process.cwd(), '.next', 'standalone', 'skills');
const sourceSkills = join(process.cwd(), 'skills');

if (!existsSync(sourceSkills)) {
    console.error('FAIL: source skills/ 디렉토리가 없음');
    process.exit(1);
}
if (!existsSync(standaloneSkills)) {
    console.error(
        'FAIL: .next/standalone/skills 가 없음 — outputFileTracingIncludes 확인 필요'
    );
    process.exit(1);
}
const count = readdirSync(standaloneSkills, { recursive: true }).filter(f =>
    f.endsWith('.md')
).length;
if (count === 0) {
    console.error('FAIL: standalone/skills 에 .md 파일이 0개');
    process.exit(1);
}
console.log(`OK: standalone/skills 에 .md ${count}개 포함`);
