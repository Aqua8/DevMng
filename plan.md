# DevMng 기획

내 개인 프로젝트를 한곳에서 보는 Backstage 기반 개발자 포털. 사내 개발자 플랫폼(IDP)을 작게 직접 만들어 보는 학습용 프로젝트다. 실제 조직에서 운영한 것이 아니라 개인 프로젝트로 만든 것이다.

## 1. 목적과 문제

- 프로젝트가 여러 저장소에 흩어져 있어 "어떤 서비스가 어디서 도는지, 지금 상태가 어떤지"를 한눈에 볼 수 없다.
- Backstage(TypeScript + React + Node.js)로 카탈로그, 플러그인, MCP 연동을 직접 구성해 보면서 IDP의 구조를 익힌다.
- 수치로 증명할 성과는 없다고 본다. 결과물은 "동작하는 포털"이다.

## 2. 범위

### 포함
| 항목 | 내용 |
|---|---|
| 소프트웨어 카탈로그 | ScheduleAlertBot, BotMng, Portfolio 3개 등록. 소유·생명주기·기술·저장소 링크, 의존 관계(BotMng → ScheduleAlertBot) |
| 프론트엔드 플러그인 | BotMng 상태 카드 (React, TypeScript) |
| 백엔드 플러그인 | BotMng `/api/health`를 읽기 전용으로 호출해 카드에 전달. 전용 서비스 계정으로 로그인 |
| BotMng 쪽 변경 | DevMng 전용 계정(역할) 추가, 그 계정의 접속 로그는 관리자에게만 표시 (별도 브랜치·PR, 사용자 승인 후 진행) |
| Backstage MCP 액션 | 설정의 `mcpActions`로 카탈로그를 MCP로 열어 Claude Code가 조회 |
| 테스트 | Jest 단위 테스트 (플러그인 로직) |
| CI | GitHub Actions: tsc, lint, test, build |
| 컨테이너 | Dockerfile로 포털 빌드 (배포는 하지 않음) |

### 제외
Kubernetes, TechDocs 운영, 인증 고도화(포털은 게스트 인증 유지), 실제 서버 배포, BotMng 외 다른 프로젝트 코드 수정.

### 핵심이 끝난 뒤 결정
소프트웨어 템플릿(새 NestJS 서비스 스캐폴더), Turborepo 빌드 캐시.

## 3. 대상 프로젝트

| 프로젝트 | 종류 | 저장소 | 비고 |
|---|---|---|---|
| ScheduleAlertBot | Discord 비서 봇 | github.com/Aqua8/ScheduleAlertBot | BotMng가 이 봇의 로그를 읽음 |
| BotMng | 로그 관제 서비스 | github.com/Aqua8/BotMng | 상태 카드 대상. 상시 구동(launchd) |
| Portfolio | 포트폴리오 사이트 | github.com/Aqua8/Portfolio | GitHub Pages 배포 |

카탈로그 파일(`catalog/*.yaml`)은 이 저장소 안에 둔다. 다른 프로젝트 저장소는 수정하지 않는다. 단 BotMng는 전용 계정 추가를 위해 수정이 필요하다(아래 4절).

## 4. 설계

### 구성
```
DevMng/
├── catalog/              # 3개 프로젝트의 Component 정의, System, Group/User
├── plugins/
│   ├── botmng/           # 프론트엔드 플러그인 (상태 카드)
│   └── botmng-backend/   # 백엔드 플러그인 (BotMng health 호출)
├── packages/app, backend # Backstage 기본 앱 (yarn workspaces 모노레포)
├── app-config.yaml
├── Dockerfile
└── .github/workflows/ci.yml
```

### BotMng 연동 (읽기 전용, DevMng 전용 계정)
- 호출 대상은 `GET /api/health` 하나뿐이고 쓰기 요청은 만들지 않는다.
- 게스트 계정을 재사용하지 않고 **DevMng 전용 서비스 계정**을 BotMng에 새로 만든다. 계정이 따로 있어야 포털의 호출과 사람의 접속을 구분할 수 있다.
- 현재 BotMng는 역할이 `admin`, `guest` 두 개뿐(`user.entity.ts`의 enum, `schema.sql`의 컬럼)이다. 필요한 BotMng 변경은 다음과 같다.
  1. 역할 `service`(가칭) 추가: enum, `schema.sql` 컬럼, 기존 DB 변경 SQL
  2. 환경 변수로 계정 시드(`DEVMNG_PASSWORD` 등). 기존 `admin`·`guest` 시드 방식과 같게 함
  3. `service` 역할은 `/api/health` 조회만 허용하고 나머지 API는 거부 (최소 권한)
  4. `service` 계정의 로그인·접속 기록은 **관리자에게만 보이게** 함. 접속 로그 목록과 접속 요약·통계에서 게스트에게는 제외
  5. 서버·웹 단위 테스트 추가
- BotMng 변경은 BotMng 저장소의 기능 브랜치에서 하고 커밋·push는 사용자가 한다. 사용자가 구현을 승인한 뒤에 시작한다.
- 서비스 계정은 화면(아이디/비밀번호) 로그인이 막혀 있다. 백엔드 플러그인은 `POST /api/auth/service`에 비밀번호를 보내 15분짜리 토큰을 받아 캐시하고, 만료 때만 다시 받는다. BotMng의 로그인 횟수 제한(IP당 분당 10회) 때문이다. 접속 정보(URL, 계정, 비밀번호)는 환경 변수로만 받고 저장소에 올리지 않는다.
- 응답 `status`(ok / warn / error)와 `issues`를 카드에 보여 준다. BotMng에 접속할 수 없으면 카드가 오류 상태를 표시하고 포털은 정상 동작한다.

### MCP
- Backstage의 `mcpActions`로 카탈로그 조회 도구를 노출하고, Claude Code에서 "BotMng 상태가 어때?"를 조회해 본다.

### 보안
- 비밀 값은 환경 변수. `.env`는 저장소에서 제외.
- 백엔드 플러그인은 BotMng 호출만 하고 쓰기 요청은 만들지 않는다. 서비스 계정은 `/api/health`만 쓸 수 있게 최소 권한으로 둔다.

## 5. 성공 기준
- [x] 로컬에서 포털이 뜨고 3개 프로젝트가 카탈로그에 보인다. (백엔드 API로 확인, 화면은 미확인)
- [x] BotMng에서 서비스 계정은 `/api/health` 외 API가 거부되고, 그 계정의 접속 기록은 게스트 화면에 보이지 않는다.
- [ ] BotMng 카탈로그 페이지에서 상태 카드가 실제 `/api/health` 값을 보여 준다.
- [ ] BotMng를 꺼도 카드가 오류 상태를 표시하고 포털은 죽지 않는다.
- [ ] 플러그인 로직 단위 테스트 통과.
- [ ] GitHub Actions에서 tsc, lint, test, build 통과.
- [ ] Docker 이미지 빌드 성공.
- [ ] Claude Code에서 MCP로 카탈로그를 조회한다.

## 6. 작업 순서
1. 기본 앱 실행 확인, 이름·설정 정리 (완료: DevMng로 개명, 의존성 설치)
2. 카탈로그에 3개 프로젝트 등록 (완료: `catalog/`에 정의, API로 3개 등록·소유·의존 관계 확인)
3. BotMng에 DevMng 전용 서비스 계정 추가 (완료: BotMng PR #15 머지, 운영 서버 반영·확인)
4. 백엔드 플러그인(서비스 계정 로그인, 토큰 캐시) + 테스트 (완료: PR #1)
5. 프론트엔드 플러그인(상태 카드) + 테스트
6. MCP 액션 연결과 조회 확인
7. GitHub Actions CI
8. Dockerfile
9. 정리(`simplify`, `code-review`, 백엔드 플러그인과 BotMng 변경은 `security-review`)
10. 선택 항목 결정(템플릿, Turborepo)

## 7. 확인 필요
- 서비스 계정 접속 기록은 접속 로그 목록에서 관리자에게만 보이고 접속 요약 통계에서는 제외했다 (BotMng PR #15). 화면 로그인은 막았다.
- 저장소는 공개(github.com/Aqua8/DevMng)다. 카탈로그와 문서에 비공개 정보(비밀번호, 내부 주소, 비공개 저장소 상세)를 넣지 않는다. 비공개인 AICC-mini는 범위에서 제외했다.

## 8. 환경 메모
- Node 24, Backstage create-app으로 생성.
- `@yarnpkg/core`가 존재하지 않는 `got` 패치 파일을 의존성으로 선언해 `yarn install`이 실패했다. 루트 `package.json`의 `resolutions`에 `"@yarnpkg/core/got": "11.8.6"`을 넣어 우회했다.
- 이 PC에는 yarn이 전역 설치되어 있지 않다. 사용 전 `corepack enable`이 필요하다.
