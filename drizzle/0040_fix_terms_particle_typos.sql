-- 현재 시행 중인 개인정보처리방침 v6·이용약관 v2 본문의 조사 표기 오타("SigLens은(는)"/"SigLens이(가)")를 바로잡는다.
-- 뜻이 바뀌지 않는 표기 수정이라 새 버전(시행일·고지)을 내지 않고 같은 행을 고친다 — 시드 스크립트는
-- (kind, version) 충돌 시 본문을 덮어쓰지 않으므로 시드 파일 수정만으로는 운영 DB에 반영되지 않는다.
-- 이전 버전 행(privacy v1~v5, tos v1)은 당시 동의한 원문 기록이라 건드리지 않는다. 재실행·빈 DB에서도 안전하다.
UPDATE "terms" SET "body" = replace("body", 'SigLens은(는)', 'SigLens는') WHERE "kind" = 'privacy' AND "version" = 6 AND "body" LIKE '%SigLens은(는)%';--> statement-breakpoint
UPDATE "terms" SET "body" = replace("body", 'SigLens이(가)', 'SigLens가') WHERE "kind" = 'tos' AND "version" = 2 AND "body" LIKE '%SigLens이(가)%';
