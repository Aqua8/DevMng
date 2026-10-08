# DevMng

내 개인 프로젝트(ScheduleAlertBot, BotMng, Portfolio)를 한곳에서 보는 [Backstage](https://backstage.io) 기반 개발자 포털입니다. 소프트웨어 카탈로그에 프로젝트와 의존 관계를 등록하고, BotMng의 상태를 카드로 보여 주며, 읽기 전용 MCP 도구로 Claude Code가 같은 정보를 조회할 수 있습니다.

**개인 학습용 프로젝트이고 로컬 전용입니다.** 조직에서 운영한 사내 개발자 플랫폼(IDP)이 아니라, 그 요건(카탈로그, 플러그인, MCP, CI/CD, 컨테이너, 모노레포, 템플릿)을 작게 직접 만들어 본 것입니다. 사용 효과 같은 정량 성과는 없습니다. 인터넷에 열지 않으며, 열려면 먼저 해야 할 일은 [docs/docker.md](docs/docker.md)에 적어 두었습니다.

## 만든 목적

- 새로운 기술을 공부하기 위해: Backstage 플러그인, MCP 도구 설계, CI/CD, 컨테이너, 모노레포
- 지원하려는 공고가 요구하는 기술(IDP·Backstage, 모노레포, MCP·AI Agent, CI/CD, TypeScript)이 무엇인지 알아보고 직접 써 보기 위해

## 기능

| 기능                | 설명                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 소프트웨어 카탈로그 | ScheduleAlertBot, BotMng, Portfolio를 컴포넌트로 등록하고 소유자와 의존 관계(BotMng → ScheduleAlertBot)를 정의 (`catalog/`)                                                                       |
| BotMng 상태 카드    | 백엔드 플러그인이 BotMng `/api/health`를 **DevMng 전용 서비스 계정**으로 읽기 전용 호출하고, 프론트엔드 플러그인이 카탈로그의 BotMng 페이지에 카드로 표시 (정상/주의/오류/연결 불가/인증 실패 등) |
| MCP 도구 2개        | `botmng.list-projects`(프로젝트 목록과 의존 관계), `botmng.get-botmng-health`(BotMng 상태). 읽기 전용이며 카탈로그의 등록·삭제 액션은 열지 않음 ([docs/mcp.md](docs/mcp.md))                      |
| 소프트웨어 템플릿   | "NestJS 서비스" 뼈대를 만들고 GitHub 저장소 생성과 카탈로그 등록까지 이어지는 템플릿 ([docs/template.md](docs/template.md))                                                                       |
| Turborepo           | 린트·테스트·빌드를 캐시하는 `yarn verify` ([docs/turborepo.md](docs/turborepo.md))                                                                                                                |
| GitHub Actions CI   | 타입 검사, 서식, 린트·테스트·빌드(Node 22·24)와 Docker 이미지 빌드                                                                                                                                |
| Docker              | 멀티스테이지 이미지와 `docker compose`(포털 + Postgres, `127.0.0.1`에만 바인딩) ([docs/docker.md](docs/docker.md))                                                                                |

## 구조

```
.
├── packages/
│   ├── app/                  프론트엔드 (Backstage 앱)
│   └── backend/              백엔드와 Dockerfile
├── plugins/
│   ├── botmng/               BotMng 상태 카드 (프론트엔드 플러그인)
│   └── botmng-backend/       BotMng 상태 조회 (백엔드 플러그인)
├── templates/nestjs-service/ 소프트웨어 템플릿 (template.yaml + skeleton)
├── catalog/                  카탈로그 정의 (프로젝트, 시스템, 그룹)
├── docs/                     docker, mcp, template, turborepo, security
├── app-config*.yaml          설정 (개발, 운영, 로컬 Docker, MCP 예시)
├── docker-compose.yml        포털 + Postgres (로컬 전용)
├── turbo.json                Turborepo 작업 정의
└── plan.md                   기획과 진행 기록
```

## 사용한 기술과 버전

"지정"은 `package.json`·설정에 적힌 범위이고, "설치"는 2026-10-08 기준으로 실제 설치된 버전입니다.

### 런타임과 도구

| 구분          | 이름       | 버전                                          |
| ------------- | ---------- | --------------------------------------------- |
| 런타임        | Node.js    | 22 또는 24 지원(`engines`), 로컬 개발 24.13.0 |
| 패키지 관리자 | Yarn       | 4.13.0 (`packageManager`)                     |
| 언어          | TypeScript | 지정 ~5.8.0, 설치 5.8.3                       |
| 모노레포 빌드 | Turborepo  | 지정 ^2.11.7, 설치 2.11.7                     |
| 테스트        | Jest       | 지정 ~30.2.0, 설치 30.2.0                     |
| 서식          | Prettier   | 지정 ^2.3.2, 설치 2.8.8                       |

### Backstage

| 구분              | 이름                                                   | 버전                                           |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------- |
| 프레임워크 릴리스 | Backstage                                              | 1.55.0 (`backstage.json`)                      |
| CLI               | `@backstage/cli`                                       | 지정 ^0.36.6, 설치 0.36.6                      |
| 백엔드 기반       | `@backstage/backend-defaults`                          | 지정 ^0.18.0, 설치 0.18.0                      |
| 카탈로그          | `@backstage/plugin-catalog-backend`                    | 설치 4.0.0                                     |
| 스캐폴더(템플릿)  | `@backstage/plugin-scaffolder-backend`                 | 설치 4.2.0                                     |
| MCP 액션          | `@backstage/plugin-mcp-actions-backend`                | 설치 0.2.2                                     |
| 게스트 로그인     | `@backstage/plugin-auth-backend-module-guest-provider` | 설치 0.2.23                                    |
| TechDocs          | `@backstage/plugin-techdocs-backend`                   | 설치 2.3.0 (스캐폴드 기본 포함, 운영하지 않음) |

### 프론트엔드

| 이름                              | 버전          |
| --------------------------------- | ------------- |
| React, React DOM                  | 설치 18.3.1   |
| `@backstage/core-components`      | 지정 ^0.18.14 |
| `@backstage/plugin-catalog-react` | 지정 ^3.2.3   |
| Testing Library (React)           | 지정 ^14.0.0  |

### 데이터와 컨테이너

| 구분               | 이름                      | 버전                                            |
| ------------------ | ------------------------- | ----------------------------------------------- |
| 운영형 DB (Docker) | PostgreSQL 이미지         | `postgres:17-alpine`, 드라이버 `pg` 설치 8.23.1 |
| 개발용 DB          | SQLite (`better-sqlite3`) | 설치 12.11.1                                    |
| 컨테이너           | Docker                    | 로컬 29.5.3, 기반 이미지 `node:24-trixie-slim`  |

### CI/CD

| 이름                 | 버전                      |
| -------------------- | ------------------------- |
| GitHub Actions 러너  | `ubuntu-24.04` (고정)     |
| `actions/checkout`   | v7.0.1 (커밋 해시로 고정) |
| `actions/setup-node` | v7.0.0 (커밋 해시로 고정) |
| `actions/cache`      | v6.1.0 (커밋 해시로 고정) |
| CI 대상 Node         | 22, 24                    |

### 템플릿이 만드는 NestJS 서비스

| 이름       | 지정 버전 |
| ---------- | --------- |
| NestJS     | ^11.1.0   |
| TypeScript | ^5.7.2    |
| Jest       | ^30.0.0   |

## 실행

로컬 전용입니다. 자세한 내용과 주의점은 [docs/docker.md](docs/docker.md)를 봅니다.

```sh
# 개발 모드
yarn install
yarn start            # 프론트엔드 http://localhost:3000, 백엔드 7007

# 컨테이너 (포털 + Postgres, 127.0.0.1에만 열림)
cp .env.example .env  # POSTGRES_PASSWORD 필수, BotMng 상태 카드를 쓰려면 BOTMNG_* 도 채움
docker compose up -d --build
# 접속: http://localhost:7007 → ENTER 버튼으로 게스트 로그인

# 검증 (린트·테스트·빌드, Turborepo 캐시 사용. 타입 검사는 yarn tsc)
yarn verify
```

코드를 바꾼 뒤에는 `docker compose up -d --build`로 이미지를 다시 만들어야 반영됩니다(`--build` 없이는 옛 이미지를 재사용합니다).

## 연동 대상

- BotMng: 상태 카드가 읽는 서비스입니다. BotMng 쪽에 만든 DevMng 전용 서비스 계정(`/api/health`만 허용)을 사용합니다.
- 비밀 값(`.env`, `app-config.local.yaml`)은 저장소와 이미지에 넣지 않습니다.

## 보안

점검 결과와 일부러 남긴 위험(로컬 전용 가정)은 [docs/security.md](docs/security.md)에 있습니다.

## 문서

| 문서                                   | 내용                                         |
| -------------------------------------- | -------------------------------------------- |
| [docs/docker.md](docs/docker.md)       | 이미지 구조, 로컬 실행, 인터넷에 열 때 할 일 |
| [docs/mcp.md](docs/mcp.md)             | MCP 도구, 토큰 설정, Claude Code 연결        |
| [docs/template.md](docs/template.md)   | 소프트웨어 템플릿                            |
| [docs/turborepo.md](docs/turborepo.md) | Turborepo 설정과 캐시                        |
| [docs/security.md](docs/security.md)   | 보안 점검과 남긴 위험                        |
| [plan.md](plan.md)                     | 기획과 진행 기록                             |
