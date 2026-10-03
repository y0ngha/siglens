# 운영 DB 이전 런북 — Neon → AWS RDS

운영 Postgres(siglens 1.38GB·테이블 29·시퀀스 1 / trader 35MB·테이블 17·시퀀스 13, 둘 다 PG 17.11, 확장은 `plpgsql`뿐, 스키마 `public` + `drizzle`)를 Neon(싱가포르)에서 AWS RDS PostgreSQL 17로 옮기는 절차다. 방식은 **Neon → RDS 논리 복제**이고, 컷오버는 **앱을 완전히 멈춘 뒤 전환**한다(두 DB에 동시에 쓰는 구간이 없다). 다운타임은 앱 정지 → 복제 따라잡기 확인 → 시작까지 약 5–8분이다.

> 장애 중이라면 [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md)가 첫 진입점이다. 이 문서는 **계획된 이전 작업**의 절차서다.

## 확정된 설계

| 항목 | 값 |
|---|---|
| 인스턴스 | `siglens-db` — RDS PostgreSQL 17, `db.t4g.small`, Single-AZ `ap-northeast-2a` |
| 스토리지 | gp3 20GB, 자동확장 상한 50GB, 암호화(AWS 관리형 `aws/rds` 키) |
| 백업·유지보수 | 백업 7일(03:00–03:30 KST), 유지보수 월 04:00–04:30 KST, 마이너 자동 업그레이드 |
| 보호 | 삭제 방지, Performance Insights 7일(무료 티어) |
| 네트워크 | 기본 VPC `vpc-05882586539cf2a7b`, 비공개. SG `siglens-rds-sg`는 5432를 `siglens-ec2-sg`·`siglens-trader-sg`에서만(SG 참조, CIDR 규칙 없음) |
| 접속 | 앱은 `sslmode=verify-full`(RDS CA 번들은 이미지에 포함 — 별도 PR). 서버는 `rds.force_ssl=1` |
| DB·롤 | DB `siglens`·`trader`, 소유 롤 `*_owner`(마이그레이션), 앱 롤 `*_app`(DML만), 마스터 `siglens_admin`(운영자 전용) |
| 로컬 개발 | 별도 터널 스크립트(별도 PR)가 SSM으로 `/siglens/RDS_ENDPOINT`에 `localhost:6543` 포트포워딩 |

SSM 파라미터:

| 이름 | 종류 | 내용 | 만드는 곳 |
|---|---|---|---|
| `/siglens/RDS_ENDPOINT` | String | RDS 호스트명(자격증명 없음) | `15-rds.sh` |
| `/siglens-rds/MASTER_PASSWORD` | SecureString | 마스터 `siglens_admin` 비밀번호 | `15-rds.sh` |
| `/siglens-rds/{SIGLENS,TRADER}_{OWNER,APP}_PASSWORD` | SecureString | 롤별 비밀번호 | §2 |
| `/siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP`, `/siglens-rds/NEON_SIGLENS_DIRECT_DATABASE_URL_BACKUP`, `/siglens-rds/NEON_TRADER_DATABASE_URL_BACKUP` | SecureString | 컷오버 직전 Neon URL 백업(롤백용). **시스템마다 이름이 다르다** | §6-2, §8-3 |

> **비밀의 위치: 왜 `/siglens-rds/`인가.** 앱 컨테이너 env는 `get-parameters-by-path /siglens/`(비재귀)로 채워져 `/siglens/` 직하위가 전부 env로 실린다. 그렇다고 `/siglens/rds/*` 같은 중첩 경로에 두면 안전하지 않다 — EC2 역할(`ReadAppSecrets`)과 CI 역할(`EnvCompletenessCheck`, 재귀 `GetParametersByPath`)의 IAM 패턴이 모두 `parameter/siglens/*`라 중첩 경로까지 읽을 수 있고, `/siglens/` 경로 자체에 대한 `GetParametersByPath`는 하위 경로에 건 명시적 Deny로도 막히지 않는다. 그래서 **`/siglens/` 밖의 별도 루트 `/siglens-rds/`**를 쓴다: 앱의 env 주입 경로와 두 역할의 `parameter/siglens/*` 패턴 모두에서 벗어난다. 운영자는 `siglens-deployer`/admin 프로파일(`AmazonSSMFullAccess`)로 읽는다. `/siglens/RDS_ENDPOINT`는 비밀이 아니고 로컬 터널 스크립트가 읽으므로 `/siglens/`에 둔다.
>
> **다만 EC2 역할은 허용 규칙이 따로 있어서 Deny가 필요하다.** `siglens-ec2-role`에 붙은 관리형 정책 `AmazonSSMManagedInstanceCore`가 `ssm:GetParameter`·`ssm:GetParameters`를 `Resource: "*"`로 허용하고(기본 버전 `v2`에서 확인), `ec2-role-policy.json`의 `DecryptSecrets`가 SSM 경유 `kms:Decrypt`를 허용하므로, 패턴 밖이라는 것만으로는 막히지 않는다. 그래서 `ec2-role-policy.json`에 **명시적 Deny**(`DenyRdsSecrets`: `GetParameter`·`GetParameters`·`GetParametersByPath`·`GetParameterHistory` on `parameter/siglens-rds`와 `parameter/siglens-rds/*`)를 추가했다. 겹치는 경로가 없는 별도 루트라서 이 Deny는 `/siglens/` 중첩 경로와 달리 실제로 동작한다. CI 역할(`siglens-ci-deploy`)은 허용 규칙이 없어 읽지 못한다 — 같은 Deny는 `ci-deploy-policy.json` 쪽에서 별도 PR이 추가한다.
>
> **trader EC2 역할(`siglens-trader-ec2-role`)은 이 레포가 관리하지 않는다**(`00-iam-setup.sh`·`iam/*.json`에 없고, 배포자 프로파일로는 정책을 조회할 권한도 없어 내용을 확인하지 못했다). 같은 `AmazonSSMManagedInstanceCore`를 쓰고 있다면 `/siglens-rds/*`를 읽을 수 있으므로, **같은 Deny 문장을 그 역할에 손으로 추가**한다:
>
> ```json
> { "Sid": "DenyRdsSecrets", "Effect": "Deny",
>   "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:GetParameterHistory"],
>   "Resource": ["arn:aws:ssm:ap-northeast-2:<ACCOUNT_ID>:parameter/siglens-rds", "arn:aws:ssm:ap-northeast-2:<ACCOUNT_ID>:parameter/siglens-rds/*"] }
> ```
>
> **IAM 정책은 손으로 적용된다.** 라이브 IAM은 레포의 JSON을 `00-iam-setup.sh`(admin 자격증명)로 밀어 넣어야 반영되고, 레포 파일을 고치는 것만으로는 바뀌지 않는다. 이 PR은 ① `siglens-deployer`에 RDS 고객 관리형 정책(`iam/deployer-rds-policy.json` → `siglens-deployer-rds`)을 붙이고 ② `siglens-ec2-role`에 위 Deny를 추가하므로, 머지 후 **`00-iam-setup.sh`를 반드시 다시 적용**해야 한다(§1-1). RDS 정책을 인라인이 아닌 관리형으로 둔 이유는 사용자 인라인 정책 합계 상한(2,048자) 때문이다(`00-iam-setup.sh` 주석 참고).

### 단계 요약

| § | 내용 | 주체 | 다운타임 | 되돌리기 |
|---|---|---|---|---|
| 0 | 선행 PR 머지·배포 확인 | 사용자 확인 | 없음 | — |
| 1 | RDS 생성, 알람, 연결 확인 | 사용자 승인 후 실행 | 없음 | 인스턴스 삭제 |
| 2 | 롤·DB 생성 | 실행 | 없음 | DROP |
| 3 | 스키마 복원 | 실행 | 없음 | DROP DATABASE 후 재생성 |
| 4 | 논리 복제 시작 | **Neon 콘솔 = 사용자**, 나머지 실행 | Neon 컴퓨트 재시작(수 초) | `DROP SUBSCRIPTION` (Neon 설정은 **되돌릴 수 없음**) |
| 5 | 검증 | 실행 | 없음 | — |
| 6 | 컷오버 (KST 새벽) | **사용자 승인 필요** | 앱 정지~시작 약 5–8분 | §7 |
| 7 | 롤백 | **사용자 승인 필요** | 상황별 | — |
| 8 | 후속 정리 | 항목별 승인 | 없음 | — |

**[승인 필요]** 표시가 붙은 단계는 사용자의 명시적 승인 없이 실행하지 않는다(비용 발생, 되돌릴 수 없음, 운영 트래픽에 영향).

---

## 0. 선행 PR 머지·배포 상태 체크리스트

RDS는 외부에서 못 들어오는 비공개 인스턴스고 Neon 전용 드라이버는 RDS와 통신하지 못한다. 아래 4개가 **머지되고 배포까지 끝난 뒤**에만 컷오버할 수 있다.

| # | PR | 왜 선행인가 | 확인 |
|---|---|---|---|
| 1 | 드라이버 교체 PR (`#___`) | 앱이 Neon serverless 드라이버(HTTP/WebSocket)를 쓰는 채로 `DATABASE_URL`을 RDS로 바꾸면 전 요청이 DB 에러다. 표준 Postgres 드라이버 + `sslmode=verify-full`(CA 번들 이미지 포함)이 먼저 운영에 있어야 한다 | 아래 ①② |
| 2 | 빌드 DB 제거 PR (`#___`) | CI 러너는 빌드 때 `/siglens/DATABASE_URL`을 읽어 DB에 붙는다(`ci-deploy-policy.json`의 `BuildTimeDbUrl`). RDS는 SG가 앱 SG에서만 열려 있어 **러너가 못 붙는다 = 컷오버 후 모든 배포 빌드 실패** | 아래 ③ |
| 3 | 로컬 DB/터널 PR (`#___`) | 운영자가 `localhost:6543` 터널로 RDS에 접속하는 도구. §1·§2·§3·§5가 이 터널(또는 아래 대체 명령)을 쓴다. 이 PR이 `dbTarget` 가드와 어떻게 맞물리는지는 §8 ⚠️ 참고 | 터널 스크립트 실행 확인 |
| 4 | 이 PR (인프라 + 런북) | `15-rds.sh`, RDS 알람, 이 문서 | 머지 후 `00-iam-setup.sh` 재실행(§1) |

```bash
# ① 머지 확인
gh pr view <번호> --json state,mergedAt,mergeCommit --jq '{state,mergedAt,sha:.mergeCommit.oid}'

# ② 운영에 실제로 떠 있는 버전이 그 PR을 포함하는지 (배포 = v* 태그 push, 확인법은 DEPLOY_RUNBOOK §1 "배포 후 확인")
git fetch --tags && git tag --contains <머지 커밋 SHA> | sort -V | head -1   # 이 태그 이상이 배포돼야 한다
gh run list --workflow=deploy.yml --limit 3                # 마지막 배포가 success인지

# ③ 빌드가 DATABASE_URL 없이 도는지 — 해당 PR 설명의 검증 기록 또는 워크플로 로그에서 확인
```

추가로 확인할 것:

- [ ] `/siglens/DATABASE_URL`을 읽는 곳이 앱 런타임뿐이다: `grep -rn "DATABASE_URL" .github src scripts --include='*.yml' --include='*.ts' | grep -v test`
- [ ] 드라이버 PR이 운영 이미지에 들어가 있는지 확인. CA는 이미지의 `/etc/ssl/certs/rds-global-bundle.pem`을 `NODE_EXTRA_CA_CERTS`로 신뢰하므로, 앱 URL에는 `sslmode=verify-full`만 붙인다(`sslrootcert` 쿼리 불필요).
- [ ] 이전 기간(복제 시작 ~ 컷오버) 동안 **DB 마이그레이션이 포함된 배포가 없다**(DDL은 논리 복제되지 않는다 — §4 참고).
- [ ] 이전 작업 시간대(§6)에 seo-prewarm이 돌지 않는다: 첫 tick이 20:30 UTC = **05:30 KST**이므로 06:00 KST 전에 끝낸다.

---

## 1. RDS 생성 · 알람 · 연결 확인

### 1-1. 권한 (admin, 1회)

`siglens-deployer`는 원래 RDS 권한이 없다. 이 PR이 `00-iam-setup.sh`에 **범위를 좁힌 고객 관리형 정책**(`iam/deployer-rds-policy.json` → `siglens-deployer-rds`, 사용자에 attach)과 RDS 서비스 연결 역할 생성을 추가했다. 풀 액세스 관리형 정책(`AmazonRDSFullAccess`)은 쓰지 않는다:

- 리전 `ap-northeast-2` 한정(`aws:RequestedRegion`), 생성·수정은 `siglens-*` DB / 서브넷 그룹 / 파라미터 그룹만.
- **`DeleteDBInstance`와 Reserved Instance 구매는 명시적 Deny** — 둘 다 admin/root 프로파일로 한다(§8-4).
- 인라인이 아닌 이유: 사용자 인라인 정책 합계 상한(2,048자)을 넘는다. 관리형은 6,144자까지 가능하고 이 정책은 그 안이다.

**admin 자격증명으로** 재실행한다(멱등: 정책이 있으면 새 버전을 기본으로 올리고, 버전이 5개면 가장 오래된 비기본 버전을 지운다). 레포 JSON을 고치는 것만으로는 라이브 IAM이 바뀌지 않는다. 이 실행은 `siglens-ec2-role`에도 `DenyRdsSecrets`를 반영한다(§설계의 비밀 위치 설명).

```bash
bash infra/aws/00-iam-setup.sh
aws --profile siglens rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier'   # AccessDenied가 아니면 OK
```

### 1-2. 인스턴스 생성 **[승인 필요: 월 비용 발생]**

```bash
bash infra/aws/15-rds.sh
```

하는 일: DB 서브넷 그룹(`siglens-db-subnets`), SG(`siglens-rds-sg`), 파라미터 그룹(`siglens-pg17`), 마스터 비밀번호 생성→SSM 저장, 인스턴스 생성, `available`까지 대기(10~15분), `/siglens/RDS_ENDPOINT` 게시. 재실행해도 안전하다(있으면 건너뛴다).

생성 직후 확인:

```bash
aws --profile siglens rds describe-db-instances --db-instance-identifier siglens-db \
  --query 'DBInstances[0].{status:DBInstanceStatus,az:AvailabilityZone,public:PubliclyAccessible,ca:CACertificateIdentifier,enc:StorageEncrypted,delprot:DeletionProtection,ver:EngineVersion,pi:PerformanceInsightsEnabled}'
aws --profile siglens ec2 describe-security-groups --filters Name=group-name,Values=siglens-rds-sg \
  --query 'SecurityGroups[0].IpPermissions[].{port:FromPort,from:UserIdGroupPairs[].GroupId,cidr:IpRanges}'
# → from: [siglens-ec2-sg 의 sg-072f66e87f5c87deb, siglens-trader-sg 의 sg-0e92496ba22adb60a], cidr: []
```

> PI(Performance Insights)를 지원하지 않는 클래스라 생성이 거절되면 `RDS_PERF_INSIGHTS=0 bash infra/aws/15-rds.sh`로 다시 돌린다.

### 1-3. 알람

```bash
bash infra/aws/07-alarms.sh
```

RDS 알람 4개가 추가된다(`siglens-rds-cpu-credits-low`·`-freeable-memory-low` P2, `-free-storage-low`·`-connections-high` P1). 표는 [DEPLOY_RUNBOOK.md §3](./DEPLOY_RUNBOOK.md). 이전 구간(§3·§4의 초기 복사)에는 `cpu-credits-low`가 예상대로 울릴 수 있다.

### 1-4. 작업 환경 준비 (이후 모든 §에서 사용)

작업 디렉터리는 **레포 밖**에 둔다(덤프에 운영 데이터가 들어간다). 쉘은 bash/zsh 모두 동작한다.

```bash
mkdir -p ~/rds-migration && cd ~/rds-migration
export AWS_PROFILE=siglens AWS_REGION=ap-northeast-2

# 도커로 postgres:17 클라이언트를 쓴다(로컬 psql 버전과 무관하게 서버와 같은 17).
psql17()       { docker run --rm -i -v "$PWD:/work" -w /work postgres:17 psql "$@"; }
pg_dump17()    { docker run --rm -i -v "$PWD:/work" -w /work postgres:17 pg_dump "$@"; }
pg_restore17() { docker run --rm -i -v "$PWD:/work" -w /work postgres:17 pg_restore "$@"; }

ssm_get() { aws ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text; }

# 비밀번호(stdin) → SCRAM-SHA-256 검증값(stdout). 롤 생성 때 평문 대신 이 값을 서버로 보낸다(§2-2).
# PostgreSQL이 저장하는 형식 그대로다: SCRAM-SHA-256$<반복>:<salt>$<StoredKey>:<ServerKey>
# (로컬 PG17에서 이 값으로 만든 롤에 평문 비밀번호로 로그인되고 틀린 비밀번호는 거부됨을 확인했다.)
scram() {
  node -e '
const c = require("crypto");
let p = "";
process.stdin.on("data", d => (p += d)).on("end", () => {
  p = p.replace(/\r?\n$/, "").normalize("NFKC");
  const salt = c.randomBytes(16), it = 4096;
  const h = (k, m) => c.createHmac("sha256", k).update(m).digest();
  const sp = c.pbkdf2Sync(p, salt, it, 32, "sha256");
  const stored = c.createHash("sha256").update(h(sp, "Client Key")).digest("base64");
  console.log("SCRAM-SHA-256$" + it + ":" + salt.toString("base64") + "$" + stored + ":" + h(sp, "Server Key").toString("base64"));
});'
}

# 터널(localhost:6543) 경유 RDS URL. 컨테이너 안에서 호스트 포트를 보려면 host.docker.internal.
# 터널은 호스트명이 RDS 인증서와 달라 verify-full이 실패하므로 여기서만 sslmode=require를 쓴다
# (암호화는 되고 호스트명 검증만 생략). 앱은 RDS 엔드포인트로 직접 붙으므로 verify-full이다.
rds_url() { echo "postgresql://$1:$2@host.docker.internal:6543/$3?sslmode=require"; }

RDS_ENDPOINT=$(aws ssm get-parameter --name /siglens/RDS_ENDPOINT --query Parameter.Value --output text)
echo "$RDS_ENDPOINT"
```

Neon URL은 **direct(비 pooler) 연결 문자열**을 Neon 콘솔(Connection details → Connection pooling 끔)에서 복사한다. 화면·히스토리에 남지 않게 입력받는다.

```bash
read -rs NEON_SIGLENS_URL && export NEON_SIGLENS_URL   # 붙여넣고 엔터
read -rs NEON_TRADER_URL  && export NEON_TRADER_URL    # trader가 같은 프로젝트면 같은 호스트, DB 이름만 다름
```

### 1-5. 연결 확인 (터널 + psql)

터널 스크립트(로컬 DB/터널 PR)를 다른 터미널에서 띄운 상태에서:

```bash
ADMIN_PW=$(ssm_get /siglens-rds/MASTER_PASSWORD)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" postgres)" -At \
  -c "select version()" \
  -c "show rds.force_ssl" -c "show log_min_duration_statement" -c "show rds.logical_replication" \
  -c "select ssl, version from pg_stat_ssl where pid = pg_backend_pid()" \
  -c "select rolname from pg_roles where rolname = 'rds_superuser'"
# → PostgreSQL 17.x / on / 500ms / off / t TLSv1.3 / rds_superuser
```

터널 스크립트가 아직 없으면 대체 명령(앱 인스턴스를 점프 호스트로 SSM 포트포워딩; `session-manager-plugin` 필요):

```bash
IID=$(aws ec2 describe-instances \
  --filters Name=tag:aws:autoscaling:groupName,Values=siglens-asg Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
aws ssm start-session --target "$IID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=$RDS_ENDPOINT,portNumber=5432,localPortNumber=6543"
```

---

## 2. 롤 · DB

권한 모델: **소유 롤**(`*_owner`)이 스키마를 만들고 마이그레이션을 돌린다. **앱 롤**(`*_app`)은 DML만 한다(DDL 불가 — 앱이 탈취돼도 스키마를 못 바꾼다). 마스터(`siglens_admin`, `rds_superuser`)는 복제 구독과 롤 관리 같은 운영 작업 전용이다.

### 2-1. 비밀번호 생성 → SSM (덮어쓰지 않는다)

`--overwrite`를 일부러 빼서, 이미 있으면 실패한다(재실행 시 기존 비밀번호를 지키는 안전장치).

```bash
for n in SIGLENS_OWNER SIGLENS_APP TRADER_OWNER TRADER_APP; do
  aws ssm put-parameter --name "/siglens-rds/${n}_PASSWORD" --type SecureString \
    --value "$(openssl rand -hex 24)" >/dev/null && echo "created $n" || echo "exists  $n (유지)"
done
```

hex라서 URL에 이스케이프 없이 들어간다.

### 2-2. 롤 + DB 생성

비밀번호는 **평문이 아니라 SCRAM 검증값**으로 서버에 보낸다. `psql -v`의 `:'var'`는 값을 안전하게 따옴표 처리해 줄 뿐 **서버로는 평문이 그대로 간다** — 서버는 실패한 문장을 에러 로그에 그대로 남기고(`log_min_error_statement`), RDS 로그는 콘솔·CLI로 내려받을 수 있다. 검증값(`SCRAM-SHA-256$...`)을 보내면 서버가 평문을 전혀 보지 못하고, 로그에 남아도 로그인에 쓸 수 없다(48자 무작위 hex라 오프라인 추측도 비현실적이다).

```bash
ADMIN_PW=$(ssm_get /siglens-rds/MASTER_PASSWORD)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" postgres)" -v ON_ERROR_STOP=1 \
  -v so_pw="$(ssm_get /siglens-rds/SIGLENS_OWNER_PASSWORD | scram)" -v sa_pw="$(ssm_get /siglens-rds/SIGLENS_APP_PASSWORD | scram)" \
  -v to_pw="$(ssm_get /siglens-rds/TRADER_OWNER_PASSWORD | scram)"  -v ta_pw="$(ssm_get /siglens-rds/TRADER_APP_PASSWORD | scram)" <<'SQL'
CREATE ROLE siglens_owner LOGIN PASSWORD :'so_pw';
CREATE ROLE siglens_app   LOGIN PASSWORD :'sa_pw';
CREATE ROLE trader_owner  LOGIN PASSWORD :'to_pw';
CREATE ROLE trader_app    LOGIN PASSWORD :'ta_pw';

-- 마스터가 owner 롤의 멤버여야 한다. 두 곳에서 필요하다:
--  (1) CREATE DATABASE ... OWNER <role> 은 생성자가 그 롤의 멤버여야 한다.
--  (2) 논리 복제 적용 워커는 테이블 소유자 권한으로 쓴다(SET ROLE). rds_superuser는
--      진짜 superuser가 아니라 ACL을 우회하지 못하므로 멤버십이 없으면 구독이
--      "permission denied for table"로 멈춘다 (§4).
GRANT siglens_owner TO siglens_admin;
GRANT trader_owner  TO siglens_admin;

CREATE DATABASE siglens OWNER siglens_owner;
CREATE DATABASE trader  OWNER trader_owner;
SQL
```

"셸 히스토리에 안 남는다"는 점은 맞다 — 비밀번호가 명령행 리터럴이 아니라 SSM에서 파이프로 흘러가기 때문이다. 다만 `ps`에는 `-v` 인자(검증값)가 잠깐 보인다. 확인:

```bash
psql17 "$(rds_url siglens_admin "$ADMIN_PW" postgres)" -c '\du' -c '\l'
# 로그인 확인은 §3-3(owner 롤)·§3-4(앱 롤)에서 평문 비밀번호로 접속하며 자연히 이뤄진다.
```

> 앱 롤에 대한 GRANT·`ALTER DEFAULT PRIVILEGES`는 스키마가 복원된 뒤(§3-4)에 한다. `drizzle` 스키마가 아직 없어서 그 전에는 `IN SCHEMA drizzle`을 쓸 수 없다.

---

## 3. 스키마

데이터는 §4의 논리 복제가 옮긴다. 여기서는 **스키마만** 복원한다.

### 3-0. 안전망: Neon 풀 덤프 1회

이전 작업이 어떻게 틀어져도 되돌릴 수 있게 **데이터 포함 덤프를 하나 받아 둔다**(1.4GB, 몇 분). Neon 프로젝트는 이전 후 2주 보존하지만 로컬 사본이 하나 더 있어야 안심이다.

```bash
pg_dump17 -Fc --no-owner --no-privileges -n public -n drizzle "$NEON_SIGLENS_URL" -f siglens-neon-full.dump
pg_dump17 -Fc --no-owner --no-privileges -n public -n drizzle "$NEON_TRADER_URL"  -f trader-neon-full.dump
ls -lh *.dump
```

### 3-1. 스키마 덤프

```bash
pg_dump17 --schema-only --no-owner --no-privileges -n public -n drizzle \
  "$NEON_SIGLENS_URL" -f siglens-schema.sql

# -n public 으로 덤프하면 이미 존재하는 public 스키마를 다시 만드는 줄이 들어 있어 복원이 거기서 죽는다.
sed -i.bak -e '/^CREATE SCHEMA public;$/d' -e '/^COMMENT ON SCHEMA public IS /d' siglens-schema.sql
grep -n '^CREATE SCHEMA\|^CREATE EXTENSION\|^COMMENT ON' siglens-schema.sql
# → CREATE SCHEMA drizzle; 와 plpgsql 관련 줄만 남아야 한다. 다른 확장이 보이면 멈추고 보고한다.
```

### 3-2. `drizzle.__drizzle_migrations` 행은 별도로 옮기지 않는다

마이그레이션 이력 테이블도 §4-2의 발행(`public`·`drizzle` 스키마의 모든 테이블)에 포함되므로 §4의 **초기 복사가 행을 채운다.** `--data-only -t drizzle.__drizzle_migrations`로 미리 넣어 두면 초기 복사가 같은 PK(`id`)를 다시 넣다가 `duplicate key value violates unique constraint`로 테이블 동기화가 멈춘다(로컬 PG17 두 대로 재현해 확인). 그래서 이 테이블은 **빈 채로** 구독을 시작한다. 복제 후 행 일치는 §5에서 확인한다.

### 3-3. 소유 롤로 복원

소유 롤로 접속해 복원해야 객체 소유자가 `siglens_owner`가 된다(`--no-owner`로 덤프했으므로 접속 롤이 소유자다).

```bash
SO_PW=$(ssm_get /siglens-rds/SIGLENS_OWNER_PASSWORD)
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -v ON_ERROR_STOP=1 -q -1 -o /dev/null -f siglens-schema.sql \
  && echo "restore ok"
```

`-1`은 한 트랜잭션이라 중간에 실패하면 아무것도 남지 않는다 — 고쳐서 그대로 재실행하면 된다.

### 3-4. 앱 롤 권한

```bash
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -v ON_ERROR_STOP=1 <<'SQL'
GRANT CONNECT ON DATABASE siglens TO siglens_app;
GRANT USAGE ON SCHEMA public, drizzle TO siglens_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, drizzle TO siglens_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO siglens_app;

-- 앞으로 siglens_owner가 마이그레이션으로 만드는 테이블·시퀀스에도 자동 부여.
-- FOR ROLE을 명시하는 이유: 기본값은 "지금 접속한 롤"이라, 다른 롤로 마이그레이션을
-- 돌리면 조용히 적용되지 않는다.
ALTER DEFAULT PRIVILEGES FOR ROLE siglens_owner IN SCHEMA public, drizzle
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO siglens_app;
ALTER DEFAULT PRIVILEGES FOR ROLE siglens_owner IN SCHEMA public, drizzle
  GRANT USAGE, SELECT ON SEQUENCES TO siglens_app;
SQL
```

확인(앱 롤로 접속해 DML은 되고 DDL은 막혀야 한다):

```bash
SA_PW=$(ssm_get /siglens-rds/SIGLENS_APP_PASSWORD)
psql17 "$(rds_url siglens_app "$SA_PW" siglens)" -At \
  -c "select count(*) from drizzle.__drizzle_migrations" \
  -c "create table public._probe (x int)" 2>&1 | tail -2
# → 0 / ERROR: permission denied for schema public
```

### 3-5. trader

trader도 같은 절차다(`siglens` → `trader`, `NEON_SIGLENS_URL` → `NEON_TRADER_URL`, `SIGLENS_*_PASSWORD` → `TRADER_*_PASSWORD`, 파일명 `trader-*`). 스키마 복원까지는 지금 해 두고, 복제·컷오버는 §8에서 한다.

---

## 4. 논리 복제

Neon(발행자) → RDS(구독자). **구독자가 발행자로 먼저 연결**한다(RDS가 Neon으로 나가는 방향).

### 4-0. 사전 점검 (Neon)

```bash
# (a) 기본키가 없는 테이블: UPDATE/DELETE가 발행되지 못해 앱 쓰기가 에러가 된다.
psql17 "$NEON_SIGLENS_URL" -At <<'SQL'
SELECT c.oid::regclass AS tbl, c.relreplident
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'drizzle')
  AND (c.relreplident = 'n'
       OR (c.relreplident = 'd'
           AND NOT EXISTS (SELECT 1 FROM pg_index i
                           WHERE i.indrelid = c.oid AND i.indisprimary)))
ORDER BY 1;
SQL
# 결과가 비어 있어야 한다. 행이 나오면 그 테이블마다 (Neon에서):
#   ALTER TABLE <tbl> REPLICA IDENTITY FULL;
```

```bash
# (b) 발행 범위 밖에 테이블이 없는가 — 발행은 public·drizzle 스키마만 대상으로 한다(§4-2).
#     다른 사용자 스키마에 테이블이 있으면 조용히 복제에서 빠진다.
psql17 "$NEON_SIGLENS_URL" -At <<'SQL'
SELECT n.nspname || '.' || c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('public', 'drizzle', 'pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg\_%'
ORDER BY 1;
SQL
# 결과가 비어 있어야 한다(확장 스키마가 없으니 plpgsql만 있는 현재는 비어 있다).
```

```bash
# (c) 어떤 형태의 발행을 Neon 롤이 허용하는가 — 복제 창을 열기 전에 미리 확인한다.
#     CREATE PUBLICATION은 트랜잭션이라 BEGIN … ROLLBACK 안에서 시험하면 아무것도 남지 않는다.
for form in "FOR TABLES IN SCHEMA public, drizzle" "FOR ALL TABLES"; do
  echo "-- $form"
  psql17 "$NEON_SIGLENS_URL" -At -c "BEGIN; CREATE PUBLICATION _probe_pub $form; ROLLBACK;" 2>&1 | grep -v '^BEGIN$' | head -2
done
# 어느 쪽이든 'CREATE PUBLICATION'(성공)이 나오면 §4-2의 (A) 스키마 단위를 쓴다.
# 둘 다 `must be superuser …`면 Neon의 롤이 슈퍼유저급이 아니다 — §4-2의 (B) 명시적 테이블 목록을 쓴다.
# (두 형태 모두 PG가 슈퍼유저를 요구하므로, 스키마 단위가 거부되면 ALL TABLES도 거부된다.)
```

- **DDL은 복제되지 않는다.** 복제 시작부터 컷오버·`DROP SUBSCRIPTION`까지 Neon과 RDS에 마이그레이션을 적용하지 않는다(적용하면 구독이 새 컬럼에서 멈춘다).
- 시퀀스 값도 복제되지 않는다 — §6-6에서 `setval`로 맞춘다.

### 4-1. Neon 논리 복제 활성화 **[승인 필요: 되돌릴 수 없음, 컴퓨트 재시작 — 사용자가 콘솔에서]**

Neon 콘솔 → 프로젝트 → Settings → **Logical Replication → Enable**.

- **한 번 켜면 끌 수 없다**(프로젝트 단위, 비가역).
- 컴퓨트가 재시작된다 — 몇 초간 연결이 끊긴다. 트래픽이 낮은 시간(KST 새벽)에 한다.
- trader가 같은 Neon 프로젝트면 이 한 번으로 끝난다. 다른 프로젝트면 각각 켠다.

```bash
psql17 "$NEON_SIGLENS_URL" -At -c "show wal_level"   # → logical
```

### 4-1b. 복제 전용 Neon 롤 **[사용자가 Neon 콘솔에서]**

구독이 Neon에 붙을 때 쓸 롤은 **`REPLICATION` 속성이 있어야 한다.** Neon에서는 **콘솔(또는 API)로 만든 롤은 `REPLICATION`이 있고, SQL `CREATE ROLE`로 만든 롤은 없다.** 그래서 앱이 쓰는 롤을 재활용하지 말고 **콘솔에서 복제 전용 롤을 새로 만든다** — 예: `repl_siglens`(trader가 별도 프로젝트면 `repl_trader`). 이유가 하나 더 있다: 이 롤의 비밀번호는 평문으로 RDS의 구독 정보(`pg_subscription`)에 저장되므로(§4-4) 앱 롤과 분리해 두면 컷오버 후 이 롤만 삭제하면 끝난다(앱·롤백 백업 URL에 영향 없음).

```bash
# 새 롤로 접속해 확인 (URL은 NEON_SIGLENS_URL의 user/password만 repl 롤로 바꾼 것)
psql17 "<repl 롤 URL>" -At \
  -c "select rolreplication from pg_roles where rolname = current_user" \
  -c "select count(*) from drizzle.__drizzle_migrations"
# → t / 숫자 (SELECT가 안 되면 콘솔 롤이 아닌 것이다)
```

### 4-2. 발행 생성 (Neon)

발행 범위는 `public`·`drizzle` 스키마의 테이블이다. §4-0 (c)에서 확인한 형태 중 하나를 쓴다. **`FOR TABLES IN SCHEMA`와 `FOR ALL TABLES`는 둘 다 PG가 슈퍼유저를 요구한다** — 한쪽이 거부되면 다른 쪽도 거부되므로, 스키마 단위가 안 되면 `FOR ALL TABLES`로 바꿔 봐야 소용없다.

**(A) 스키마 단위** — Neon 롤이 허용할 때(§4-0 (c)에서 `CREATE PUBLICATION`이 나온 경우). 앞으로 두 스키마에 생기는 테이블도 자동 포함된다.

```bash
psql17 "$NEON_SIGLENS_URL" -v ON_ERROR_STOP=1 \
  -c "CREATE PUBLICATION siglens_pub FOR TABLES IN SCHEMA public, drizzle;"
```

**(B) 명시적 테이블 목록** — 둘 다 `must be superuser`일 때. **테이블 소유자**(또는 소유 롤의 멤버)로 접속해 Neon 카탈로그에서 목록을 만들어 발행한다. 마이그레이션 동결(§4-0)이 전제이므로 목록은 복제 기간 동안 변하지 않는다 — 새 테이블이 생기면 `ALTER PUBLICATION siglens_pub ADD TABLE …`을 별도로 해야 한다.

```bash
TABLES=$(psql17 "$NEON_SIGLENS_URL" -At <<'SQL'
SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p') AND n.nspname IN ('public', 'drizzle');
SQL
)
echo "$TABLES"     # siglens 29개 / trader 17개를 눈으로 센다 (대소문자·공백 이름은 따옴표로 감싸져 나온다)
[ -n "$TABLES" ] || { echo "ERROR: 테이블 목록이 비어 있다"; false; }
psql17 "$NEON_SIGLENS_URL" -v ON_ERROR_STOP=1 -c "CREATE PUBLICATION siglens_pub FOR TABLE $TABLES;"
```

(B)는 로컬 PG17에서 비슈퍼유저 소유 롤로 확인했다(스키마 단위·ALL TABLES는 `must be superuser`로 거부, 명시 목록은 성공).

어느 쪽이든 결과를 확인한다:

```bash
psql17 "$NEON_SIGLENS_URL" -At -c "select schemaname, count(*) from pg_publication_tables where pubname = 'siglens_pub' group by 1"
# → drizzle|1 / public|28   (siglens 기준 합 29, trader는 합 17)
```

trader도 같은 방식(`trader_pub`)이다.

### 4-3. RDS를 일시 공개 **[승인 필요: 복제 구간 동안만 공인 IP]**

기본 VPC에는 NAT가 없어 공인 IP가 없는 RDS는 인터넷(Neon)으로 **나가지 못한다.** `PubliclyAccessible`은 아웃바운드 경로를 위한 것이고, SG에 CIDR 인그레스가 없으므로 인터넷에서 5432로 들어올 수는 없다.

```bash
bash infra/aws/15-rds.sh --make-public
```

- Neon 프로젝트에 **IP Allow**가 켜져 있으면 RDS 공인 IP를 허용해야 한다: `dig +short "$RDS_ENDPOINT"`(공개 후에는 공인 IP가 나온다).
- 터널은 그대로 쓸 수 있다(SG 경로는 변하지 않는다).

### 4-4. 구독 생성 (RDS, 마스터)

Neon 연결은 **keyword/value 형식**으로 쓴다(URL 형식은 비밀번호의 특수문자 이스케이프가 까다롭다). 복제 전용 롤(§4-1b)을 쓴다. 비밀번호가 **셸 히스토리**에 남지 않게 `read -s`로 받아 psql 변수로 넘긴다.

```bash
read -rs NEON_PW   # 복제 전용 Neon 롤의 비밀번호
NEON_CONN="host=<neon direct 호스트, -pooler 아님> port=5432 dbname=<neon db> user=repl_siglens password=${NEON_PW} sslmode=require"

psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -v ON_ERROR_STOP=1 -v neon_conn="$NEON_CONN" <<'SQL'
CREATE SUBSCRIPTION siglens_sub
  CONNECTION :'neon_conn'
  PUBLICATION siglens_pub
  WITH (copy_data = true, disable_on_error = true);
SQL
unset NEON_PW NEON_CONN
```

`disable_on_error = true`(PG15+): 적용 중 에러(충돌·권한)가 나면 구독이 **같은 에러를 무한 재시도하지 않고 스스로 멈춘다.** 멈춘 걸 알아채려면 모니터링(§4-5)에서 `subenabled`와 에러 카운트를 본다 — 조용히 멈춰 있으면 Neon 쪽 WAL이 쌓이니 방치하지 않는다. 복구는 §4-7.

> ⚠️ **평문 비밀번호 주의.** 복제 연결 정보는 평문으로 RDS 서버에 전달되고 `pg_subscription.subconninfo`에 평문으로 저장된다(슈퍼유저만 조회). 위 `read -s`는 **셸 히스토리**만 막는다 — 서버 쪽에서는 이 문장이 실패하면 에러 로그에 연결 문자열(비밀번호 포함)이 남는다(`log_min_error_statement`). 그래서 (1) 앱 롤이 아닌 **복제 전용 롤**을 쓰고, (2) 구문 에러 등으로 한 번이라도 실패했으면 그 즉시 Neon 콘솔에서 이 롤의 비밀번호를 바꾸고, (3) 컷오버 후 **롤 자체를 삭제**한다(§6-11).

구독 연결 정보는 `DROP SUBSCRIPTION`(§6-11)이 지운다.

> 이 구간은 CPU를 많이 쓴다(1.4GB 초기 복사 + 인덱스 갱신). t4g.small은 크레딧을 태우므로 `siglens-rds-cpu-credits-low` 알람이 울릴 수 있다 — 예상된 소모다. Unlimited 모드라 느려지진 않고 초과분만 과금된다.

### 4-5. 모니터링

```sql
-- RDS (구독자)
-- (1) 워커 상태와 마지막 수신
SELECT subname, pid, received_lsn, latest_end_lsn, latest_end_time FROM pg_stat_subscription;
-- (2) 테이블 동기화 상태: 전부 'r'(ready)이 되면 초기 복사 완료.  i→d→f→s→r 순으로 진행
SELECT srsubstate, count(*) FROM pg_subscription_rel GROUP BY 1;
SELECT srrelid::regclass, srsubstate FROM pg_subscription_rel WHERE srsubstate <> 'r';
-- (3) 에러 누적 — 0이어야 한다
SELECT subname, apply_error_count, sync_error_count FROM pg_stat_subscription_stats;
```

```sql
-- Neon (발행자)
-- (1) 슬롯: active=t 이고 lag이 작아야 한다
SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
FROM pg_replication_slots;
-- (2) 복제 지연: streaming 상태에서 lag_bytes ≈ 0, replay_lag 초 단위 이하
SELECT application_name, state,
       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes, replay_lag
FROM pg_stat_replication;
```

초기 복사 중에는 `pg_stat_replication`에 테이블 동기화용 연결이 따로 보이고, 끝나면 `siglens_sub` 하나가 `streaming`으로 남는다.

문제 시: RDS 로그(콘솔 또는 `aws rds download-db-log-file-portion`)에서 `logical replication`을 찾는다. 흔한 원인:

| 증상 | 원인 |
|---|---|
| `permission denied for table` | §2-2의 `GRANT <owner> TO siglens_admin`을 빠뜨렸다 → 부여 후 `ALTER SUBSCRIPTION siglens_sub ENABLE` |
| `duplicate key value` (초기 복사) | RDS 테이블에 이미 행이 있다(§3-2). 구독을 지우고 해당 테이블을 `TRUNCATE`한 뒤 다시 만든다 |
| **적용이 멈춤**: `pg_stat_subscription.pid`가 NULL이거나 `latest_end_time`이 계속 과거, `subenabled = f`, 에러 카운트 증가, Neon 슬롯 `active = f`·lag 증가 | `disable_on_error`로 스스로 멈췄거나 워커가 같은 에러를 반복 중이다. **§4-7**로 원인(RDS 로그의 `CONTEXT` 줄)부터 읽는다 |
| `must be superuser or replication role` / `permission denied to start WAL sender` | Neon 롤에 `REPLICATION`이 없다(SQL `CREATE ROLE`로 만든 롤). 콘솔로 만든 롤을 쓴다(§4-1b) |
| `could not connect to the publisher` / 타임아웃 | `--make-public` 미적용, Neon IP Allow, 호스트가 pooler |
| `column ... does not exist` | 복제 중 한쪽에만 마이그레이션이 적용됐다 |

### 4-6. Neon 비용

**복제 슬롯이 active인 동안 Neon 컴퓨트는 오토서스펜드되지 않는다**(walsender가 연결을 잡고 있다). 구독을 유지한 시간만큼 CU-hour가 나간다. 그래서 §4~§6을 같은 날에 끝내는 것을 권장한다. 구독이 멈춘 채로 방치하면 비활성 슬롯이 WAL을 계속 붙잡아 Neon 스토리지가 불어난다 — 중단할 거면 반드시 구독과 슬롯을 지운다.

### 4-7. 구독이 멈췄을 때 (복구)

**진단** — 위에서 아래로, 원인이 나오는 곳에서 멈춘다.

```sql
-- RDS: 구독이 켜져 있는가 / 워커가 도는가 / 에러가 쌓이는가
SELECT subname, subenabled FROM pg_subscription;
SELECT subname, pid, latest_end_lsn, latest_end_time FROM pg_stat_subscription;   -- pid NULL = 워커 없음
SELECT subname, apply_error_count, sync_error_count FROM pg_stat_subscription_stats;
SELECT srrelid::regclass, srsubstate FROM pg_subscription_rel WHERE srsubstate <> 'r';
```

```bash
# RDS 에러 로그에서 원인 문장과 CONTEXT 줄을 읽는다
aws rds describe-db-log-files --db-instance-identifier siglens-db --query 'DescribeDBLogFiles[-4:].LogFileName' --output text
aws rds download-db-log-file-portion --db-instance-identifier siglens-db \
  --log-file-name error/postgresql.log.<YYYY-MM-DD-HH> --output text \
  | grep -B1 -A3 'logical replication' | tail -40
```

로그의 핵심은 두 줄이다:

```
ERROR:  duplicate key value violates unique constraint "…"          ← 무엇이 충돌했나(테이블·키)
CONTEXT:  processing remote data for replication origin "pg_16395" during message type "INSERT"
          for replication target relation "public.xxx" in transaction 7489, finished at 0/4EBF9D8
                                                                      ↑ 건너뛸 때 쓰는 LSN
```

**복구 옵션** — 위가 먼저다.

| 순서 | 옵션 | 언제 | 방법 |
|---|---|---|---|
| 1 | **데이터를 고친다** | 충돌 행이 RDS에만 있는 찌꺼기(예: §3-2를 어기고 미리 넣은 행, 컷오버 후 앱이 쓴 행)이거나 대상 행이 비어 있어 UPDATE/DELETE가 못 붙는 경우 | RDS에서 해당 행을 삭제/보정(owner 롤) → 멈춘 구독이면 `ALTER SUBSCRIPTION siglens_sub ENABLE;`. 켜져 있으면 워커가 알아서 재시도한다 |
| 2 | **트랜잭션 건너뛰기** | 그 트랜잭션을 버려도 되는 경우(캐시성 데이터)이거나 이미 RDS에 같은 효과가 반영돼 있음을 확인한 경우 | `ALTER SUBSCRIPTION siglens_sub SKIP (lsn = '0/4EBF9D8');` (로그의 `finished at` 값). 권한이 모자라면 `pg_replication_origin_advance('pg_<subid>', '<lsn>')`(`select oid from pg_subscription`으로 subid 확인). **그 트랜잭션 전체가 RDS에 반영되지 않는다** — 반드시 §5-1·§5-2로 해당 테이블을 대조하고 필요하면 수동으로 메운다 |
| 3 | **버리고 다시 동기화** | 원인을 못 찾았거나 여러 테이블이 어긋난 경우, 컷오버 전 | `ALTER SUBSCRIPTION siglens_sub DISABLE; DROP SUBSCRIPTION siglens_sub;` → RDS의 해당 테이블(또는 전체)을 `TRUNCATE` → §4-4부터 다시. `DROP SUBSCRIPTION`은 Neon 슬롯도 지운다(실패하면 Neon에서 `pg_drop_replication_slot`) |

원칙: **컷오버를 시작하기 전에 구독이 멈춘 걸 발견했다면 옵션 3까지 감수하고 처음부터 다시 맞춘다.** 컷오버 도중(§6-5)에 멈춘 걸 발견하면 앱은 이미 정지 상태이므로 옵션 1·2로 따라잡을 수 있는지 먼저 보고, 안 되면 §6-5의 중단 절차(앱을 다시 시작하고 Neon 유지, ASG 재개)로 돌아간다.

---

## 5. 검증

복제가 `streaming`이고 §4-5 (2)가 전부 `r`인 상태에서, **Neon이 계속 쓰이고 있으므로** 행 수는 정확히 같지 않을 수 있다(복제 지연 몇 행). 지연이 0에 가까운 순간 두 쪽을 비슷한 시각에 재거나, 쓰기가 드문 시간대에 한다. 아래 생성기는 **Neon의 카탈로그에서** 쿼리를 만들어 양쪽에 같은 파일을 돌린다.

### 5-1. 테이블별 행 수

```bash
cat > gen_counts.sql <<'SQL'
SELECT string_agg(
         format('SELECT %L AS tbl, count(*) AS n FROM %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname),
         E'\nUNION ALL\n' ORDER BY n.nspname, c.relname)
       || E'\nORDER BY 1;'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'drizzle');
SQL

psql17 "$NEON_SIGLENS_URL" -At -f gen_counts.sql > counts.sql
psql17 "$NEON_SIGLENS_URL"                         -At -f counts.sql > counts.neon.txt
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -f counts.sql > counts.rds.txt
diff counts.neon.txt counts.rds.txt && echo "행 수 일치"
wc -l counts.neon.txt   # 29 (siglens) / 17 (trader) 이어야 한다
```

차이가 나면 해당 테이블만 다시 센다. 계속 벌어지면 구독 상태(§4-5)부터 본다.

### 5-2. 체크섬 (작은 테이블)

PK 순서로 행 전체를 문자열로 이어 md5를 낸다. **50MB 미만 + PK가 있는 테이블만** 대상이다(큰 테이블은 행 수와 최근 행 샘플로 갈음).

```bash
cat > gen_md5.sql <<'SQL'
SELECT format('SELECT %L AS tbl, count(*) AS n, md5(coalesce(string_agg(t::text, '''' ORDER BY %s), '''')) AS md5 FROM %I.%I t;',
              n.nspname || '.' || c.relname, pk.cols, n.nspname, c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL (
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) AS cols
  FROM pg_index i
  CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
  WHERE i.indrelid = c.oid AND i.indisprimary
) pk ON pk.cols IS NOT NULL
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'drizzle')
  AND pg_total_relation_size(c.oid) < 50 * 1024 * 1024
ORDER BY n.nspname, c.relname;
SQL

# 타임존을 고정해 timestamptz::text 표기가 양쪽에서 같게 한다.
( echo "SET timezone = 'UTC';"; psql17 "$NEON_SIGLENS_URL" -At -f gen_md5.sql ) > md5.sql
psql17 "$NEON_SIGLENS_URL"                         -qAt -f md5.sql > md5.neon.txt
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -qAt -f md5.sql > md5.rds.txt
diff md5.neon.txt md5.rds.txt && echo "체크섬 일치"
```

쓰기가 계속되는 테이블은 지연 때문에 어긋날 수 있다. 어긋난 테이블만 몇 초 뒤 다시 재고, **계속 어긋나면** 진짜 불일치다. `drizzle.__drizzle_migrations`는 쓰기가 없어 항상 일치해야 한다.

### 5-3. 시퀀스 목록

복제되지 않는 값이므로 컷오버 전에 **무엇이 있는지** 본다. siglens는 1개, trader는 13개여야 한다.

```bash
psql17 "$NEON_SIGLENS_URL" -At -c "SELECT schemaname || '.' || sequencename, last_value FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1"
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -c "SELECT schemaname || '.' || sequencename, last_value FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1"
# RDS 쪽 last_value는 비어(NULL) 있다 = 아직 한 번도 안 쓰였다. §6-6에서 맞춘다.
```

### 5-4. 합격 기준

- [ ] `pg_subscription_rel` 전부 `r`, `apply_error_count`·`sync_error_count` = 0
- [ ] 행 수·체크섬이 일치(또는 지연 범위 내 설명 가능)
- [ ] 앱 롤로 접속해 SELECT 가능(§3-4)
- [ ] 슬롯 lag이 몇 분 연속 ≈ 0

---

## 6. 컷오버 (KST 새벽) **[승인 필요]**

**시각**: KST **04:30–05:20** 권장. 03:00–03:30(RDS 백업 창), 04:00–04:30(유지보수 창)과 겹치지 않고, 05:30(seo-prewarm 첫 tick) 전에 끝난다. 시작 직전에 사용자에게 시작 승인을 받는다.

**원칙: 두 DB에 동시에 쓰는 구간이 없다.** 앱을 **전 인스턴스에서 완전히 멈추고**(진행 중인 SSE 분석이 끝나기를 기다린다) → Neon 쓰기가 멎고 복제가 따라잡았음을 확인 → 시퀀스를 맞추고 → `DATABASE_URL`을 바꾸고 → 시작한다. 재시작 방식(바꾸고 곧바로 재시작)은 인스턴스마다 DB가 갈리는 구간과, 그 사이 ASG가 띄우는 새 인스턴스가 옛 값을 읽는 구간을 만든다.

**다운타임**: 정지 시작부터 시작 완료까지 약 5–8분(정지 드레인 수십 초~최대 190초, 따라잡기 확인 1~2분, 기동 ~40초). 그동안 cloudflared는 살아 있어 사용자는 Cloudflare 오류 페이지를 본다.

| 단계 | 내용 | 되돌리기 |
|---|---|---|
| 6-1 | 시작 전 확인 | — |
| 6-2 | Neon URL 백업 | — |
| 6-3 | ASG 프로세스 정지 | 6-9에서 재개 |
| 6-4 | 앱 정지 + 드레인 (**여기서부터 다운타임**) | `systemctl start siglens` |
| 6-5 | 쓰기 정지·복제 따라잡기·정합성 확인 | **여기까지는 SSM이 그대로라 앱만 다시 시작하면 원상복구** |
| 6-6 | 시퀀스 맞춤 | RDS 쪽 값일 뿐, 무해 |
| 6-7 | SSM `DATABASE_URL` 교체 | §7-A |
| 6-8 | 앱 시작 | §7-A |
| 6-9 | ASG 프로세스 재개 | — |
| 6-10 | 확인 | §7-A |
| 6-11 | 구독 제거·비공개 복귀 | §7-B |

### 6-0. 헬퍼 (이 § 전체에서 쓴다)

```bash
ASG=siglens-asg

# 전 앱 인스턴스에 같은 명령을 한 번에 보낸다. 인자: JSON 배열 문자열 → CommandId
ssm_all() {
  aws ssm send-command --targets Key=tag:aws:autoscaling:groupName,Values=$ASG \
    --document-name AWS-RunShellScript --parameters "commands=$1" \
    --timeout-seconds 900 --query 'Command.CommandId' --output text
}

# 모든 인스턴스가 끝날 때까지 기다리고, 결과를 출력하고, 하나라도 Success가 아니면 실패(1)를 반환한다.
# 대상이 0건이면(태그 타깃 불일치) 15분 뒤 실패한다.
ssm_wait() {
  local st i
  for i in $(seq 1 180); do
    st=$(aws ssm list-command-invocations --command-id "$1" --query 'CommandInvocations[].Status' --output text)
    case "$st" in *Pending*|*InProgress*|*Delayed*|"") sleep 5 ;; *) break ;; esac
  done
  aws ssm list-command-invocations --command-id "$1" --details \
    --query 'CommandInvocations[].{id:InstanceId,status:Status,out:CommandPlugins[0].Output}' --output json
  [ -n "$st" ] && [ -z "$(echo "$st" | tr '\t' '\n' | grep -v '^Success$')" ]
}

# 실행 중인 앱 인스턴스 수 — ssm_wait 결과 건수와 같아야 한다
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG \
  --query 'AutoScalingGroups[0].Instances[].[InstanceId,LifecycleState]' --output text
```

### 6-1. 시작 전 확인

```bash
# 구독이 건강한가 (RDS)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At \
  -c "select subenabled from pg_subscription" \
  -c "select srsubstate, count(*) from pg_subscription_rel group by 1" \
  -c "select apply_error_count, sync_error_count from pg_stat_subscription_stats"
# → t / r|<전체> / 0|0

# 지연 ≈ 0 (Neon) — 이 값이 몇 분 연속 작아야 한다
psql17 "$NEON_SIGLENS_URL" -At -c "select pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) from pg_replication_slots"

# 앱이 정상이고, 진행 중인 배포가 없다
curl -s https://siglens.io/api/ready
gh run list --workflow=deploy.yml --limit 2
aws autoscaling describe-instance-refreshes --auto-scaling-group-name $ASG --query 'InstanceRefreshes[0].Status' --output text   # InProgress가 아니어야 한다

# 앱 롤 비밀번호가 SSM에 있다
ssm_get /siglens-rds/SIGLENS_APP_PASSWORD >/dev/null && echo "app pw ok"
```

(롤백 때 쓸 `CUTOVER_AT`은 여기서 기록하지 않는다 — 앱을 시작하기 **직전**인 §6-8에서 기록한다. 지금 기록하면 정지·확인·시퀀스 구간 동안 복제로 RDS에 들어온 행까지 "컷오버 후 쓰기"로 잡힌다.)

### 6-2. Neon URL 백업 (롤백용)

현재 값을 `/siglens-rds/`에 보관한다. **시스템마다 이름이 다르다**(siglens ↔ trader가 같은 이름을 쓰면 나중에 한쪽 롤백이 다른 쪽 URL로 복구된다). **이미 있으면 덮어쓰지 않고 실패한다** — 재시도 중이라면 그 값은 이미 한 번 백업해 둔 원본 Neon URL이고, 덮어쓰면 (그사이 `DATABASE_URL`이 RDS로 바뀐 경우) 롤백 원본을 영영 잃는다.

```bash
# backup_param <원본 SSM 이름> <백업 SSM 이름> — 새로 만들고, 원본과 같은지 확인(값은 출력하지 않는다)
backup_param() {
  aws ssm put-parameter --name "$2" --type SecureString --value "$(ssm_get "$1")" >/dev/null \
    || { echo "ERROR: $2 가 이미 있거나 만들지 못했다 — 아래 확인 후 진행"; return 1; }
  [ "$(ssm_get "$1")" = "$(ssm_get "$2")" ] && echo "backed up $1 -> $2" || { echo "ERROR: 백업 값이 원본과 다르다"; return 1; }
}

backup_param /siglens/DATABASE_URL        /siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP        &&
backup_param /siglens/DIRECT_DATABASE_URL /siglens-rds/NEON_SIGLENS_DIRECT_DATABASE_URL_BACKUP &&
echo "backup ok"

# "이미 있다"로 실패했다면: 그 값이 Neon을 가리키는 원본인지 호스트만 보고 판단한다
ssm_get /siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP | sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#'   # *.neon.tech 여야 한다
# Neon 호스트면 그대로 두고 진행. 아니면(RDS 호스트면) 원본이 날아간 것이다 — 멈추고 Neon 콘솔에서 URL을 다시 구해 SSM에 직접 쓴다
```

### 6-3. ASG 프로세스 정지

앱을 멈추면 인스턴스의 `siglens-selfcheck`가 헬스 실패를 감지해 `set-instance-health Unhealthy`를 표시하고 ASG가 인스턴스를 **교체**한다. 새 인스턴스는 부팅 시 SSM을 읽으므로 교체 시점이 6-7 전후냐에 따라 Neon을 쓰는 인스턴스나 RDS를 쓰는 인스턴스가 하나 더 생긴다. 이를 막으려고 창 동안 ASG의 교체·기동을 멈춘다.

```bash
aws autoscaling suspend-processes --auto-scaling-group-name $ASG \
  --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG \
  --query 'AutoScalingGroups[0].SuspendedProcesses[].ProcessName' --output text   # 네 개가 보여야 한다
```

> 이 상태로 **끝내지 않는다.** 6-9에서 반드시 재개한다(재개를 잊으면 인스턴스 장애·스케일아웃이 자동 복구되지 않는다). 중간에 중단하는 경우에도 §6-5 말미의 중단 절차가 재개를 포함한다.

### 6-4. 앱 정지 + 드레인 (여기서부터 다운타임)

```bash
# selfcheck 타이머를 먼저 멈춘다 — 안 그러면 앱 정지를 장애로 읽고 `[selfcheck]`를 찍어
# P1 알람(siglens-app-unhealthy)이 울리고 인스턴스에 Unhealthy 표시가 남는다
# (계획된 종료에서 user-data.sh의 drain 스크립트가 같은 이유로 가장 먼저 하는 일이다).
CMD=$(ssm_all '["systemctl stop siglens-selfcheck.timer","systemctl stop siglens","systemctl is-active siglens || true","echo containers=$(docker ps -q --filter name=siglens | wc -l)"]')
ssm_wait "$CMD"
# → 인스턴스마다 status=Success, 출력에 inactive 와 containers=0
```

`systemctl stop siglens`는 `docker stop -t 185`가 끝날 때까지 돌아오지 않는다 — 진행 중인 SSE 분석이 있으면 최대 180초(드레인) 걸리고, 이 명령의 완료가 곧 "드레인 끝"이다. `ssm_wait`가 모든 인스턴스의 Success를 확인할 때까지 다음으로 가지 않는다.

### 6-5. 쓰기 정지 · 복제 따라잡기 · 정합성 확인

앱은 이미 멈췄으므로 Neon의 변경은 더 늘지 않는다. **복제가 그 마지막 변경까지 RDS에 적용됐는지**를 본다. 아래 함수는 모든 검사를 한 번에 돌리고, **하나라도 실패하면 `return 1`로 멈춘다**(블록을 붙여 넣는 대화형 셸에서는 `exit`/`set -e`가 뒤 줄을 막지 못하므로 함수로 묶었다). 따라잡기 루프는 2분 안에 안 되면 실패다.

```bash
precutover_check() {
  local Q t1 t2 target ok r i sub
  Q="select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) from pg_stat_user_tables"

  # (a) Neon에 쓰기가 없다 — 세션은 참고용으로 보여 주고, 판정은 변경 카운터가 멎었는지로 한다
  echo "-- Neon 클라이언트 세션 (앱 풀 잔여 연결은 곧 사라진다. 내부 관리 롤이 보이면 무시)"
  psql17 "$NEON_SIGLENS_URL" -At -c "select usename, count(*) from pg_stat_activity where datname = current_database() and backend_type = 'client backend' and pid <> pg_backend_pid() group by 1" || return 1
  t1=$(psql17 "$NEON_SIGLENS_URL" -At -c "$Q") || return 1
  sleep 20
  t2=$(psql17 "$NEON_SIGLENS_URL" -At -c "$Q") || return 1
  [ -n "$t1" ] && [ "$t1" = "$t2" ] || { echo "FAIL(a): Neon에 아직 쓰기가 있다 ($t1 -> $t2)"; return 1; }

  # (b) 복제 지연 0: 지금 Neon의 WAL 위치를 구독자가 확인할 때까지 기다린다 (최대 2분)
  target=$(psql17 "$NEON_SIGLENS_URL" -At -c "select pg_current_wal_lsn()") || return 1
  [ -n "$target" ] || { echo "FAIL(b): Neon LSN을 읽지 못했다"; return 1; }
  echo "target LSN: $target"
  ok=no
  for i in $(seq 1 60); do
    r=$(psql17 "$NEON_SIGLENS_URL" -At -c "select coalesce(bool_or(pg_wal_lsn_diff('$target', replay_lsn) <= 0), false) from pg_stat_replication where application_name = 'siglens_sub'") || return 1
    if [ "$r" = "t" ]; then ok=yes; break; fi
    sleep 2
  done
  [ "$ok" = "yes" ] || { echo "FAIL(b): 2분 안에 따라잡지 못했다 — 구독 상태는 §4-7"; return 1; }
  echo "caught up"

  # (c) 구독이 켜져 있고 에러가 0
  sub=$(psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At -c "select (select subenabled::int from pg_subscription where subname = 'siglens_sub') || '|' || (select apply_error_count || '|' || sync_error_count from pg_stat_subscription_stats where subname = 'siglens_sub')") || return 1
  [ "$sub" = "1|0|0" ] || { echo "FAIL(c): 구독 상태가 정상이 아니다 ($sub, 기대값 1|0|0) — §4-7"; return 1; }

  # (d) 양쪽이 정확히 같다 — 쓰기가 멎었으므로 이제는 지연 핑계가 없다 (§5-1·§5-2와 같은 명령)
  psql17 "$NEON_SIGLENS_URL"                         -At -f counts.sql > counts.neon.txt || return 1
  psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -f counts.sql > counts.rds.txt  || return 1
  diff counts.neon.txt counts.rds.txt || { echo "FAIL(d): 행 수 불일치"; return 1; }
  psql17 "$NEON_SIGLENS_URL"                         -qAt -f md5.sql > md5.neon.txt || return 1
  psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -qAt -f md5.sql > md5.rds.txt  || return 1
  diff md5.neon.txt md5.rds.txt || { echo "FAIL(d): 체크섬 불일치"; return 1; }
  return 0
}

precutover_check && echo "PRECHECK PASS" || echo "PRECHECK FAIL — 진행 금지, 아래 원상복구"
```

**`PRECHECK PASS`가 나오기 전에는 §6-6으로 가지 않는다.** 실패하면 SSM이 아직 Neon이므로 이렇게 원상복구한다(그리고 원인은 §4-7로):

```bash
CMD=$(ssm_all '["systemctl start siglens","systemctl start siglens-selfcheck.timer"]'); ssm_wait "$CMD"
aws autoscaling resume-processes --auto-scaling-group-name $ASG --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
```

### 6-6. 시퀀스를 Neon 값 + 작은 여유분으로 맞춘다

복제된 행은 시퀀스를 올리지 않으므로, RDS에서 앱이 INSERT하면 id 1부터 시작해 **복제된 행과 PK가 충돌한다.** 이 시점에 Neon 쓰기는 멎었으므로 `last_value`가 최종값이다 — 여유분(`margin`)은 거의 필요 없고, 명시적 id로 넣은 행·롤백된 INSERT 같은 예외를 덮을 정도(1,000)면 충분하다. id가 건너뛰는 것은 문제없다.

```bash
# Neon의 pg_sequences로 RDS에서 실행할 setval 문을 만든다.
psql17 "$NEON_SIGLENS_URL" -At <<'SQL' > setval.sql
SELECT format('SELECT setval(%L, %s, true);',
              quote_ident(schemaname) || '.' || quote_ident(sequencename),
              COALESCE(last_value, 0) + 1000)
FROM pg_sequences
WHERE schemaname IN ('public', 'drizzle')
ORDER BY schemaname, sequencename;
SQL
cat setval.sql    # siglens: 1줄 / trader: 13줄. 값을 눈으로 확인한다.

psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -v ON_ERROR_STOP=1 -f setval.sql

# 검증: 모든 시퀀스에서 RDS 값 ≥ Neon 값 (join은 정렬 순서에 민감하다 — 양쪽을 LC_ALL=C로 다시 정렬. 한쪽에만 있으면 MISSING)
Q="SELECT schemaname || '.' || sequencename || '|' || COALESCE(last_value, 0) FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1"
psql17 "$NEON_SIGLENS_URL"                         -At -c "$Q" > seq.neon.txt
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -c "$Q" > seq.rds.txt
LC_ALL=C join -t'|' -a1 -a2 -e MISSING -o 0,1.2,2.2 <(LC_ALL=C sort seq.neon.txt) <(LC_ALL=C sort seq.rds.txt) \
  | awk -F'|' '$2=="MISSING" || $3=="MISSING" || $3+0 < $2+0 { print "위험:", $0 }'
echo "(출력이 없으면 안전)"
```

### 6-7. SSM `DATABASE_URL`을 RDS 앱 롤로 교체

필수 값이 비어 있으면 `postgresql://siglens_app:…@:5432/…` 같은 깨진 URL이 SSM에 써지고 시작한 앱 전체가 DB에 못 붙는다. 그래서 값을 **검증한 뒤에만** 쓰도록 함수로 묶었고, 하나라도 비면 아무것도 쓰지 않고 `return 1`한다.

```bash
switch_database_url() {
  local sa_pw new_url
  # 앱은 RDS 엔드포인트로 직접 붙는다(터널 아님) → sslmode=verify-full.
  # CA는 이미지의 NODE_EXTRA_CA_CERTS(RDS global bundle)로 신뢰하므로 URL에는 sslmode=verify-full만 붙인다(§0).
  [ -n "${RDS_ENDPOINT:-}" ] || { echo "ERROR: RDS_ENDPOINT가 비어 있다 (§1-4를 다시 실행)"; return 1; }
  case "$RDS_ENDPOINT" in
    *.rds.amazonaws.com) ;;   # verify-full이 인증서 호스트명과 맞으려면 RDS 엔드포인트여야 한다
    *) echo "ERROR: RDS_ENDPOINT가 *.rds.amazonaws.com 이 아니다: $RDS_ENDPOINT"; return 1 ;;
  esac
  sa_pw=$(ssm_get /siglens-rds/SIGLENS_APP_PASSWORD) || return 1
  { [ -n "$sa_pw" ] && [ "$sa_pw" != "None" ]; } || { echo "ERROR: 앱 롤 비밀번호가 비어 있다"; return 1; }
  # 롤백 원본(§6-2)이 있어야 값을 바꾼다
  ssm_get /siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP >/dev/null || { echo "ERROR: Neon URL 백업이 없다 (§6-2)"; return 1; }

  new_url="postgresql://siglens_app:${sa_pw}@${RDS_ENDPOINT}:5432/siglens?sslmode=verify-full"
  aws ssm put-parameter --name /siglens/DATABASE_URL --type SecureString --value "$new_url" --overwrite >/dev/null || return 1
  echo "DATABASE_URL -> RDS"

  # DIRECT_DATABASE_URL은 drizzle.config.ts(CLI) 전용이라 앱 런타임은 안 읽는다. Neon을 가리킨 채 두면
  # 오해의 씨앗이므로 지운다(백업은 §6-2에 있다).
  aws ssm delete-parameter --name /siglens/DIRECT_DATABASE_URL || return 1
  echo "DIRECT_DATABASE_URL deleted"
}

switch_database_url && echo "SWITCH OK" || echo "SWITCH FAIL — 앱을 시작하지 말 것"
```

> 비밀번호가 hex(영숫자)라 URL 이스케이프가 필요 없다. **`SWITCH OK`가 나오기 전에는 §6-8로 가지 않는다.**

### 6-8. 앱 시작

`siglens.service`는 시작할 때마다 `ExecStartPre`로 SSM을 다시 읽으므로 **시작만으로 새 `DATABASE_URL`이 반영된다.** 전 인스턴스에 동시에 보낸다.

롤백 때 "컷오버 이후 RDS에만 들어간 쓰기"를 찾는 기준 시각을 **시작 직전에** 기록한다. 이 시점부터 앱이 RDS에 쓴다(구독은 이미 따라잡았고 앱이 멈춰 있어 복제 유입도 없다).

```bash
CUTOVER_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ); echo "$CUTOVER_AT"   # 롤백 시 이 시각 이후의 RDS 쓰기를 찾는다(§7)
CMD=$(ssm_all '["systemctl start siglens","for i in $(seq 1 60); do curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null && break; sleep 5; done","curl -s -m 10 http://127.0.0.1:3000/api/ready","systemctl start siglens-selfcheck.timer"]')
ssm_wait "$CMD"
# → 인스턴스마다 Success, /api/ready 응답에 DB 정상. 결과 건수 = 6-0에서 센 인스턴스 수
```

기동은 보통 30~40초다(`/api/health`가 응답할 때까지 최대 5분 대기). selfcheck 타이머는 앱이 살아난 **뒤에** 다시 켠다.

### 6-9. ASG 프로세스 재개

```bash
aws autoscaling resume-processes --auto-scaling-group-name $ASG \
  --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG \
  --query 'AutoScalingGroups[0].SuspendedProcesses' --output text   # 비어 있어야 한다
```

### 6-10. 컷오버 확인

```bash
# (1) 레디니스 — DB+Redis 핑이 모두 통과해야 200
curl -s -o /dev/null -w "%{http_code}\n" https://siglens.io/api/ready

# (2) 앱 에러 로그 (최근 10분). 인증/SSL/접속 계열이 하나라도 있으면 §7 롤백 판단
aws logs filter-log-events --log-group-name /siglens/app \
  --start-time $(( ($(date +%s) - 600) * 1000 )) \
  --filter-pattern '?"password authentication failed" ?"SSL" ?"certificate" ?"ECONNREFUSED" ?"ETIMEDOUT" ?"too many clients" ?"permission denied" ?"[ready]"' \
  --query 'events[].message' --output text | head -30
```

```bash
# (3) 앱이 RDS에 붙었는가 — 앱 롤 세션이 보인다
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At \
  -c "select usename, count(*) from pg_stat_activity where datname='siglens' group by 1"
# → siglens_app 이 보여야 한다 (siglens_admin 은 이 질의를 날리는 본인)

# (4) 쓰기가 RDS에 들어온다 — 복제 유입이 없으므로 증가분 = 앱 쓰기다 (RDS), 60초 간격
Q="select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) from pg_stat_user_tables"
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At -c "$Q"; sleep 60; \
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At -c "$Q"

# (5) Neon은 조용하다 — 6-5 (a)의 값에서 변하지 않는다
psql17 "$NEON_SIGLENS_URL" -At -c "$Q"
```

(4)는 증가, (5)는 6-5의 값과 같아야 한다. 실제 화면 확인도 한다(종목 페이지 로드, 로그인 필요 없는 분석 요청 1건) — 브라우저 확인은 사용자 몫이다. 에러가 나면 §7-A.

### 6-11. 구독 제거 · Neon 정리 · 비공개 복귀

컷오버 후 **10분 이상** 문제없이 관찰한 뒤 한다. **이 시점부터 §7 롤백 A(무손실에 가까운 경로)가 닫힌다.**

```bash
# (1) 행 수 최종 대조 — RDS는 컷오버 후 쓰기가 더해졌으므로 "모든 테이블에서 RDS ≥ Neon"이면 된다
psql17 "$NEON_SIGLENS_URL"                         -At -f counts.sql > counts.neon.final.txt
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -f counts.sql > counts.rds.final.txt
LC_ALL=C join -t'|' -a1 -a2 -e MISSING -o 0,1.2,2.2 <(LC_ALL=C sort counts.neon.final.txt) <(LC_ALL=C sort counts.rds.final.txt) \
  | awk -F'|' '$2=="MISSING" || $3=="MISSING" || $3+0 < $2+0 { print "RDS가 적다/없다:", $0 }'

# (2) 구독 비활성화 후 제거 (RDS) — DROP이 Neon의 복제 슬롯도 함께 지운다
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -v ON_ERROR_STOP=1 -c "ALTER SUBSCRIPTION siglens_sub DISABLE;"
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -v ON_ERROR_STOP=1 -c "DROP SUBSCRIPTION siglens_sub;"

# (3) Neon 정리 — 슬롯이 사라졌는지, 남았으면 직접 지운다(남으면 WAL이 쌓이고 컴퓨트가 안 잠든다)
psql17 "$NEON_SIGLENS_URL" -At -c "select slot_name, active from pg_replication_slots"
#   남아 있으면: select pg_drop_replication_slot('siglens_sub');
psql17 "$NEON_SIGLENS_URL" -v ON_ERROR_STOP=1 -c "DROP PUBLICATION siglens_pub;"

# (4) RDS를 다시 비공개로
bash infra/aws/15-rds.sh --make-private
```

**(5) 복제 전용 Neon 롤 삭제 [사용자, Neon 콘솔]**: §4-1b의 `repl_siglens`를 삭제한다. 이 롤의 비밀번호는 평문으로 `pg_subscription`에 저장됐고 RDS 서버를 거쳤다(`DROP SUBSCRIPTION`으로 카탈로그 행은 사라졌지만 로그·스냅샷에 흔적이 있을 수 있다). 삭제하면 그 비밀번호는 쓸모가 없어진다. 앱 롤(`neondb_owner` 등)은 롤백 B 경로를 위해 그대로 둔다.

Neon IP Allow에 RDS IP를 추가했다면 지운다. 이후 Neon 컴퓨트는 오토서스펜드로 돌아가 비용이 거의 멈춘다(프로젝트 삭제는 §8).

---

## 7. 롤백 **[승인 필요]**

### A. `DROP SUBSCRIPTION` **이전** — 앱만 Neon으로 되돌린다

복제가 아직 살아 있어 Neon에는 컷오버 이전 데이터와 그 이후 Neon에 들어온 쓰기가 전부 있다. **컷오버 이후 RDS에만 들어간 쓰기는 사라진다**(RDS→Neon 방향 복제가 없다).

컷오버와 같은 순서로 한다 — **앱을 멈추고, 값을 되돌리고, 시작한다**(두 DB에 동시에 쓰는 구간을 만들지 않는다). §6-0의 헬퍼를 쓴다.

```bash
# 1) ASG 프로세스 정지 → 앱 정지(+ selfcheck) — §6-3, §6-4와 같다
aws autoscaling suspend-processes --auto-scaling-group-name $ASG --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
CMD=$(ssm_all '["systemctl stop siglens-selfcheck.timer","systemctl stop siglens","systemctl is-active siglens || true"]'); ssm_wait "$CMD"

# 1-1) 앱을 Neon으로 다시 켜기 **전에** RDS 구독부터 끈다. 켜 둔 채 앱을 Neon으로 돌리면
#      재개된 Neon 쓰기가 RDS로 복제돼 컷오버 후 RDS에만 쓴 행(아래에서 살릴 대상)을 덮어쓰거나
#      PK 충돌로 구독을 세운다. 슬롯은 남아 있으니 아래 "롤백 직후 구독 정리"를 이어서 한다.
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -v ON_ERROR_STOP=1 -c "ALTER SUBSCRIPTION siglens_sub DISABLE;"

# 2) SSM을 Neon으로 복구 (백업 이름은 시스템별로 다르다)
aws ssm put-parameter --name /siglens/DATABASE_URL --type SecureString \
  --value "$(ssm_get /siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP)" --overwrite >/dev/null && echo "restored DATABASE_URL"
aws ssm put-parameter --name /siglens/DIRECT_DATABASE_URL --type SecureString \
  --value "$(ssm_get /siglens-rds/NEON_SIGLENS_DIRECT_DATABASE_URL_BACKUP)" --overwrite >/dev/null && echo "restored DIRECT_DATABASE_URL"

# 3) 시작 → 확인 → ASG 재개 — §6-8, §6-9와 같다
CMD=$(ssm_all '["systemctl start siglens","for i in $(seq 1 60); do curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null && break; sleep 5; done","curl -s -m 10 http://127.0.0.1:3000/api/ready","systemctl start siglens-selfcheck.timer"]'); ssm_wait "$CMD"
aws autoscaling resume-processes --auto-scaling-group-name $ASG --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
```

**유실된 쓰기를 찾는 법** (RDS에서, §6-8에서 앱 시작 직전에 기록한 `CUTOVER_AT` 이후):

```bash
# (a) created_at/updated_at 컬럼이 있는 테이블: 컷오버 이후 행 수
cat > gen_since.sql <<'SQL'
SELECT string_agg(
         format('SELECT %L AS tbl, %L AS col, count(*) AS rows_since FROM %I.%I WHERE %I >= :''since''',
                n.nspname || '.' || c.relname, a.attname, n.nspname, c.relname, a.attname),
         E'\nUNION ALL\n' ORDER BY n.nspname, c.relname, a.attname)
       || E'\nORDER BY 3 DESC, 1;'
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'drizzle')
  AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attname IN ('created_at', 'updated_at')
  AND a.atttypid IN ('timestamptz'::regtype, 'timestamp'::regtype);
SQL
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -f gen_since.sql > since.sql
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -v since="$CUTOVER_AT" -f since.sql | awk -F'|' '$3 > 0'

# (b) 타임스탬프 컬럼이 없는 테이블까지 포함한 대략적 변경량 (통계는 인스턴스 재시작 시 초기화됨)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At -c \
  "select relname, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_user_tables where n_tup_ins + n_tup_upd + n_tup_del > 0 order by 2 desc limit 20"
```

(a)에서 나온 행이 필요한 것이면(예: 가입·결제 성격의 사용자 데이터) `\copy (SELECT ... WHERE created_at >= :'since') TO`로 뽑아 Neon에 `INSERT ... ON CONFLICT DO NOTHING`으로 되살린다. 되살린 뒤 Neon 시퀀스를 `setval`로 올린다(RDS id는 `last_value + 1000`부터라 Neon 시퀀스가 뒤처진다). 캐시성 데이터면 버린다.

**롤백 직후 반드시 구독부터 정리한다.** 위 롤백은 앱만 Neon으로 되돌렸을 뿐 RDS의 구독은 **살아 있고**, RDS에는 컷오버 후 앱이 쓴 행과 `setval`로 올라간 시퀀스가 남아 있다. 방치하면 두 가지가 터진다 — (1) Neon에 새로 쌓이는 행이 복제로 들어오다 RDS에만 있는 행과 PK가 충돌해 구독이 멈추고(`disable_on_error = true`면 스스로 꺼진다), (2) 구독 슬롯이 Neon의 WAL을 계속 붙잡고 컴퓨트가 잠들지 못한다. 순서는 이렇다:

```bash
# 1) 구독은 위 롤백 1-1)에서 이미 비활성화했다(확인만 한다). 슬롯은 아직 남아 WAL을 붙잡으므로 오래 두지 않는다
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -At -c "select subname, subenabled from pg_subscription"   # subenabled = f

# 2) 위의 "유실된 쓰기를 찾는 법"으로 RDS에만 있는 행을 살린다 (RDS 데이터는 아직 그대로 있어야 한다)

# 3) 구독 제거 — Neon 슬롯도 함께 지워진다 (§6-11 (2),(3)과 같다)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -v ON_ERROR_STOP=1 -c "DROP SUBSCRIPTION siglens_sub;"
psql17 "$NEON_SIGLENS_URL" -At -c "select slot_name, active from pg_replication_slots"   # 비어 있어야 한다 (남으면 pg_drop_replication_slot)
```

**다시 시도하지 않고 접는다면** 여기까지로 끝이다(발행 `siglens_pub`는 Neon에 남겨 둬도 무해하지만 §6-11 (3)처럼 지워도 된다). **다시 시도한다면** RDS를 비우고 §4-4부터 한다 — 안 비우면 새 초기 복사가 RDS에 남은 행과 PK로 충돌한다:

```bash
# RDS의 두 스키마 테이블 전체를 비운다 (owner 롤). drizzle.__drizzle_migrations도 포함 — 초기 복사가 다시 채운다 (§3-2)
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At <<'SQL' > truncate.sql
SELECT 'TRUNCATE ' || string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname) || ';'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname IN ('public', 'drizzle');
SQL
cat truncate.sql    # 목록을 눈으로 확인한 뒤
psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -v ON_ERROR_STOP=1 -f truncate.sql
```

시퀀스는 비울 필요가 없다 — §6-6의 `setval`이 다시 덮어쓴다. 데이터베이스째 새로 만들 수도 있다(`DROP DATABASE siglens` 후 §2-2의 `CREATE DATABASE`부터, 스키마는 §3 재복원).

### B. `DROP SUBSCRIPTION` **이후** — RDS → Neon 되돌리기

Neon에 컷오버 이후의 데이터가 없으므로 RDS를 Neon으로 덤프·복원한다. **이 동안 쓰기를 멈춰야 하므로 사이트가 내려간다**(1.4GB 기준 약 15–30분).

```bash
# 1) 쓰기 정지: ASG 프로세스 정지 + 앱 중지 (cloudflared는 둬서 에러 페이지가 나가게 한다) — §6-3, §6-4
aws autoscaling suspend-processes --auto-scaling-group-name $ASG --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
CMD=$(ssm_all '["systemctl stop siglens-selfcheck.timer","systemctl stop siglens","systemctl is-active siglens || true"]'); ssm_wait "$CMD"

# 2) RDS 덤프 (owner 롤로, 터널 경유)
pg_dump17 -Fc --no-owner --no-privileges -n public -n drizzle \
  "$(rds_url siglens_owner "$SO_PW" siglens)" -f siglens-rds-final.dump

# 3) Neon 복원 — 기존 객체를 지우고 다시 만든다. 구독/슬롯은 이미 없다
pg_restore17 --clean --if-exists --no-owner --no-privileges --single-transaction \
  -d "$NEON_SIGLENS_URL" siglens-rds-final.dump
#   pg_dump -Fc 는 시퀀스 현재값도 담는다. 행 수는 §5-1 방식으로 양쪽 대조한다.

# 4) SSM 복구 → 시작 → ASG 재개
aws ssm put-parameter --name /siglens/DATABASE_URL --type SecureString \
  --value "$(ssm_get /siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP)" --overwrite >/dev/null
aws ssm put-parameter --name /siglens/DIRECT_DATABASE_URL --type SecureString \
  --value "$(ssm_get /siglens-rds/NEON_SIGLENS_DIRECT_DATABASE_URL_BACKUP)" --overwrite >/dev/null
CMD=$(ssm_all '["systemctl start siglens","for i in $(seq 1 60); do curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null && break; sleep 5; done","curl -s -m 10 http://127.0.0.1:3000/api/ready","systemctl start siglens-selfcheck.timer"]'); ssm_wait "$CMD"
aws autoscaling resume-processes --auto-scaling-group-name $ASG --scaling-processes Launch ReplaceUnhealthy HealthCheck AZRebalance
```

> Neon 프로젝트를 컷오버 후 **2주간 지우지 않는 이유가 이 경로다.** `3-0`에서 받은 풀 덤프(`siglens-neon-full.dump`)는 컷오버 이전 시점이라 B의 복원 원본으로는 쓰지 않는다(최신이 아님) — 최후의 보루일 뿐이다.

---

## 8. 후속

### 8-1. Draft PR 머지 순서

DB 스키마가 걸린 PR은 **RDS에 마이그레이션을 먼저 적용하고 코드를 배포한다**(코드가 새 컬럼을 읽는데 컬럼이 없으면 에러).

1. **#915 asset-info** — 컷오버가 안정화(§6-11 완료)된 뒤 머지·배포.
2. **#916 plain** — **마이그레이션 0039를 RDS에 먼저 적용**한 뒤 머지·배포:
   ```bash
   # owner 롤 URL로 마이그레이션 (터널 경유). 이 PR 머지 전에 RDS에 반영돼 있어야 한다.
   DIRECT_DATABASE_URL="postgresql://siglens_owner:$(ssm_get /siglens-rds/SIGLENS_OWNER_PASSWORD)@localhost:6543/siglens?sslmode=require" \
     ALLOW_REMOTE_DB_WRITE=1 yarn db:migrate
   psql17 "$(rds_url siglens_owner "$SO_PW" siglens)" -At -c "select count(*) from drizzle.__drizzle_migrations"   # 0039 포함 개수로 늘었는지
   ```

> ⚠️ **터널(`localhost:6543`)은 운영이다.** 로컬 DB/터널 PR이 `db/scripts/lib/dbTarget.ts`를 고쳐 로컬 호스트라도 포트 6543이면 REMOTE(`viaTunnel`)로 판정하므로 `assertRemoteWriteAllowed`가 막고, 쓰려면 `ALLOW_REMOTE_DB_WRITE=1`이 필요하다. 그래도 `yarn db:*`를 쓸 때마다 대상 출력(`formatTarget`, `REMOTE via tunnel :6543 = PRODUCTION`)을 확인한다. 이전 후 `.env.local`은 로컬 개발 DB(`localhost:5435`)를 가리키게 하고 `DIRECT_DATABASE_URL`도 같은 값으로 맞추거나 지운다.

### 8-2. 일회성 캐시 스크립트

운영 DB에 대고 돌리던 일회성 캐시/백필 스크립트(레포 밖에 보관)는 `DATABASE_URL` 대상을 RDS(터널, owner 롤)로 바꿔서만 실행한다. Neon URL이 남아 있는 사본은 폐기한다.

### 8-3. trader 컷오버

siglens와 **같은 단계**(§2 → §3 → §4 → §5 → §6 → §7)를 `trader`로 반복한다. 다른 점:

| 항목 | siglens | trader |
|---|---|---|
| DB·롤 | `siglens` / `siglens_owner`·`siglens_app` | `trader` / `trader_owner`·`trader_app` |
| 발행·구독 | `siglens_pub` / `siglens_sub` | `trader_pub` / `trader_sub` |
| SSM URL | `/siglens/DATABASE_URL` | `/siglens-trader/DATABASE_URL` |
| 비밀번호 | `/siglens-rds/SIGLENS_*_PASSWORD` | `/siglens-rds/TRADER_*_PASSWORD` |
| Neon URL 백업 | `/siglens-rds/NEON_SIGLENS_DATABASE_URL_BACKUP`, `…_DIRECT_DATABASE_URL_BACKUP` | `/siglens-rds/NEON_TRADER_DATABASE_URL_BACKUP` (**siglens와 이름이 겹치면 안 된다** — `backup_param`은 이미 있으면 실패한다) |
| 시퀀스 | 1개 | 13개 (`setval.sql` 13줄 확인) |
| 호스트 | ASG `siglens-asg` | 단일 EC2 `i-0a44a942039e42a4f`(2c, `siglens-trader-sg`) |
| 정지·시작 | §6-3~§6-9 (`ssm_all`은 ASG 태그 타깃) | 단일 박스라 `--instance-ids i-0a44a942039e42a4f`로 보낸다(ASG 소속이면 같은 `suspend-processes`를 그 ASG에 적용, 아니면 생략). 서비스 이름을 먼저 확인: `aws ssm send-command --instance-ids i-0a44a942039e42a4f --document-name AWS-RunShellScript --parameters 'commands=["systemctl list-units --type=service --no-legend | grep -i trader"]'`. selfcheck 타이머가 없으면 해당 줄은 생략 |
| 코드 PR | 드라이버 교체·빌드 DB 제거(§0) | **trader 레포의 별도 PR** (같은 드라이버 교체 + `sslmode=verify-full` + CA 번들). 이 PR들이 trader 운영에 배포돼 있어야 한다 |

trader는 데이터가 35MB라 초기 복사가 수십 초다. siglens 컷오버가 안정화된 뒤(최소 하루) 진행해 한 번에 한 시스템만 건드린다. trader는 AZ 2c라 RDS(2a)와 AZ 간 전송이 발생하지만 트래픽이 작아 무시할 수준이다. `siglens-rds-sg`는 이미 `siglens-trader-sg`를 허용한다.

### 8-4. Reserved Instance 구매 **[승인 필요: 약 $325 선결제]**

1주일 운영해 인스턴스 크기가 맞는지([DEPLOY_RUNBOOK §3](./DEPLOY_RUNBOOK.md)의 RDS 알람 이력, CPU 크레딧, 메모리, Performance Insights) 확인한 뒤 구매한다. 기대 사양: `db.t4g.small`, PostgreSQL, **Single-AZ**, 1년, All Upfront ≈ **$325**. RDS RI는 같은 패밀리(t4g) 안에서 **크기 유연성**이 있어, 나중에 `db.t4g.medium`으로 올려도 약정이 정규화 단위로 이어진다.

**admin/root 프로파일로 한다.** `siglens-deployer`는 `PurchaseReservedDBInstancesOffering`이 명시적 Deny다(§1-1) — 실수로 선결제가 나가지 않게 하는 장치다. 아래 `<admin>`은 admin 자격증명의 프로파일 이름이다.

```bash
aws --profile <admin> rds describe-reserved-db-instances-offerings \
  --db-instance-class db.t4g.small --product-description postgresql \
  --duration 31536000 --offering-type "All Upfront" --no-multi-az \
  --query 'ReservedDBInstancesOfferings[].{id:ReservedDBInstancesOfferingId,fixed:FixedPrice,recurring:RecurringCharges}'
# 금액과 id를 사용자에게 보여주고 승인받은 뒤에만:
aws --profile <admin> rds purchase-reserved-db-instances-offering --reserved-db-instances-offering-id <id> --db-instance-count 1
```

### 8-5. Neon 프로젝트 삭제 **[승인 필요: 되돌릴 수 없음]**

컷오버 후 **2주** 문제가 없으면 삭제한다. 삭제 전:

- [ ] Neon의 모든 테이블 행 수가 RDS 이하인지 §6-11 (1)의 대조를 한 번 더 한다(RDS는 컷오버 후 쓰기가 더해져 ≥여야 한다)
- [ ] 로컬 사본 `siglens-neon-full.dump`·`trader-neon-full.dump` 보관(암호화된 위치, 몇 달) 또는 폐기 결정
- [ ] `/siglens-rds/NEON_*_BACKUP` SSM 삭제, Neon 콘솔의 복제 전용 롤(`repl_*`)이 지워졌는지 확인, 코드·문서에 남은 Neon URL 제거

### 8-6. 문서·메모리 갱신

- [ ] `grep -rniI "neon" docs infra src db scripts .github README.md CLAUDE.md --exclude-dir=node_modules`로 남은 언급을 찾아 갱신. 특히 [DEPLOY_RUNBOOK.md](./DEPLOY_RUNBOOK.md)의 "`.env.local`은 **운영 Neon**을 가리킨다" 절, `infra/aws/README.md`의 `/api/ready`("Neon DB + Upstash") 설명.
- [ ] DEPLOY_RUNBOOK §6 부트스트랩 표(8번 `15-rds.sh`), 고정 좌표에 RDS 추가
- [ ] 사용자 메모리: 운영 DB가 RDS(`siglens-db`)이고 마이그레이션은 owner 롤로 터널 경유라는 점, 터널(6543)은 가드상 REMOTE라는 점, 마스터 비밀번호 위치(`/siglens-rds/MASTER_PASSWORD`)
- [ ] 이 문서의 상단을 "계획"에서 "완료 기록(날짜, 실제 소요, 겪은 문제)"으로 갱신

---

## 부록: 자주 쓰는 확인 명령

```bash
# 인스턴스 상태 / 엔드포인트 / 공개 여부
aws rds describe-db-instances --db-instance-identifier siglens-db \
  --query 'DBInstances[0].{status:DBInstanceStatus,endpoint:Endpoint.Address,public:PubliclyAccessible,storage:AllocatedStorage}'

# 현재 연결 수 / 장기 쿼리 (마스터)
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -c \
  "select usename, application_name, state, count(*) from pg_stat_activity where datname='siglens' group by 1,2,3 order by 4 desc"
psql17 "$(rds_url siglens_admin "$ADMIN_PW" siglens)" -c \
  "select pid, now() - query_start as dur, left(query, 80) from pg_stat_activity where state <> 'idle' and now() - query_start > interval '5 seconds' order by 2 desc"

# 슬로우 쿼리 로그 (500ms 초과)
aws rds describe-db-log-files --db-instance-identifier siglens-db --query 'DescribeDBLogFiles[].LogFileName'
```
