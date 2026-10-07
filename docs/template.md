# 소프트웨어 템플릿: NestJS 서비스

Backstage의 소프트웨어 템플릿(스캐폴더)으로 **새 NestJS 서비스의 뼈대**를 만든다. 포털의 "Create" 메뉴에서 "NestJS 서비스"를 고르고 이름·설명·저장소를 입력하면 뼈대를 만들어 GitHub 저장소로 올리고 카탈로그에 등록한다. 선택 항목으로 작게 만들었다.

## 구성

```
templates/nestjs-service/
├── template.yaml          # 입력(이름·설명·저장소)과 3단계: 뼈대 만들기 → GitHub 저장소 만들기 → 카탈로그 등록
└── skeleton/              # 만들어지는 서비스의 뼈대 (${{ }} 는 템플릿 변수)
    ├── src/               # main, AppModule, GET /health, Jest 테스트
    ├── Dockerfile         # 멀티스테이지, node 사용자, HEALTHCHECK
    ├── .github/workflows/ci.yml
    ├── catalog-info.yaml  # 만들어진 서비스가 카탈로그에 등록될 때 쓰는 정의
    └── package.json, package-lock.json, tsconfig*.json, README.md, .env.example ...
```

템플릿은 `app-config.yaml`(개발)과 `app-config.production.yaml`(이미지)의 `catalog.locations`에 `Template`만 허용하는 규칙으로 등록되어 있고, Docker 이미지에는 `/app/templates`로 들어간다.

## 안전하게 만든 기본값

- **이름 검증**: `^[a-z][a-z0-9-]{2,38}$`. 저장소 이름과 패키지 이름이 되므로 특수문자를 막는다.
- **설명이 파일 형식을 깨지 못하게**: 설명을 `package.json`과 `catalog-info.yaml`에 넣을 때 `dump` 필터로 이스케이프한다. 설명에 따옴표가 있어도 올바른 JSON/YAML이 나오는 것을 확인했다.
- **만들어진 서비스**는 `127.0.0.1`에서만 접속을 받고(`HOST`로 바꿈), Docker 이미지는 `node` 사용자로 실행하며, CI는 읽기 권한만 쓰고 액션을 커밋 해시로 고정하고 `npm ci`로 `package-lock.json`을 고정한다.
- **저장소는 비공개**로 만든다.

## 사용하려면

- 포털을 실행할 때 `GITHUB_TOKEN` 환경 변수(저장소를 만들 권한이 있는 토큰)가 필요하다. 지금은 설정하지 않았다.
- **주의**: 이 포털은 로컬 전용이고 게스트 로그인에 권한 정책이 모두 허용이라(`docs/security.md`), `GITHUB_TOKEN`을 설정하면 **게스트도 템플릿을 실행해 그 토큰으로 저장소를 만들 수 있다.** 내 컴퓨터에서만 접속되는 구성에서만 쓰고, 토큰은 필요한 최소 권한으로 만든다. 템플릿은 MCP로 노출되지 않는다(`docs/mcp.md`).

## 확인한 것 (2026-10-08)

컨테이너에서 실제로 실행해 확인했다.

- 카탈로그에 `Template`으로 등록됨
- **스캐폴더 dry-run**으로 뼈대 15개 파일이 렌더링됨. 템플릿 변수가 모두 치환되고 남은 `${{`가 없음, 설명에 따옴표를 넣어도 JSON/YAML이 올바름, 저장소 주소에서 `owner/repo`가 올바르게 나옴
- **렌더링된 결과물을 실제로 검증**: `npm ci`(394개 패키지), `npm test`(1개 통과), `npm run build`, 서버 기동 후 `GET /health`가 200, 접속 주소가 `localhost`로만 열림, 생성된 Dockerfile로 이미지를 빌드해(83MB) `cap_drop ALL`로 실행: 헬스체크 `healthy`, 실행 사용자 `node`, `/health` 200
- **뼈대의 의존성 취약점**: 처음 만든 뼈대(jest 29)는 `npm audit`에서 34건(높음 29건)이었다. `braces`와 `sprintf-js`의 오래된 버전이 원인이라 `jest 30`으로 올려 **20건(전부 보통)**으로 줄였다. **운영 의존성은 0건**이다

## 확인하지 못한 것 (솔직하게)

- **`publish:github`와 `catalog:register` 단계는 실행해 보지 못했다.** 스캐폴더 dry-run이 이 두 액션을 "지원하지 않아 건너뜀"으로 처리하고, 실제로 저장소를 만들려면 토큰이 필요한데 설정하지 않았고 내 GitHub에 시험용 저장소를 만들고 싶지 않았다. 즉 "뼈대 만들기"까지만 검증했고 저장소 생성과 등록은 검증하지 않았다.
- 포털 화면의 "Create" 흐름(입력 폼, 저장소 선택 UI)은 브라우저로 확인하지 않았다.
- **남은 20건은 고치지 못했다.** 원인은 `sprintf-js` 하나(서비스 거부, 권고 GHSA-hp3w-g68c-fv3c)이고 **최신 버전(1.1.3)도 영향 범위라 고칠 수 있는 버전이 아직 없다.** 경로는 `jest → babel-plugin-istanbul → js-yaml → argparse → sprintf-js`로 테스트 도구의 커버리지 설정 로더뿐이며 개발 의존성이라 운영 이미지에는 들어가지 않는다(`npm prune --omit=dev`). 그래서 받아들이고 기록했다. `npm audit fix --force`가 제안하는 `jest 25`로의 내림은 오히려 나쁘므로 쓰지 않았다.
- 뼈대의 `package-lock.json`은 템플릿을 만든 시점의 의존성 버전이다. 시간이 지나면 갱신해야 한다(`npm install` 후 다시 커밋). 만들어진 서비스의 CI는 **운영 의존성에 높음 이상 취약점이 생기면 실패**하도록 `npm audit --omit=dev --audit-level=high`를 돌리지만(이 단계는 렌더링 결과를 로컬에서 실행해 확인했을 뿐 GitHub Actions에서 돌려 보지는 않았다), 자동 업데이트(Dependabot)는 넣지 않았다.
- 인증, 데이터베이스, 설정 검증, 로깅은 뼈대에 없다. "시작점"일 뿐이다.
