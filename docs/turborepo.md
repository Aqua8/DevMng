# Turborepo

린트·테스트·빌드를 [Turborepo](https://turborepo.com)로 실행하고 결과를 캐시한다. 공고의 우대 요건("Nx·Turborepo 모노레포")을 직접 써 보려고 도입한 선택 항목이다.

```bash
yarn verify   # 패키지별 lint, test, build 를 실행하고 .turbo 에 캐시 (CI=true 로 실행)
```

## 설정 (`turbo.json`)

- `lint`, `test`, `build` 세 작업을 정의했다. 모든 패키지(`app`, `backend`, 플러그인 2개)가 `backstage-cli package lint|test|build`로 같은 이름의 스크립트를 가지고 있어서 그대로 붙었다.
- 각 작업은 `dependsOn: ["^같은 작업"]`을 가진다. **이것이 정확성의 핵심이다**(아래).
- `globalDependencies`: `yarn.lock`, `tsconfig.json`, ESLint·Prettier 설정, `app-config*.yaml`이 바뀌면 전체 캐시가 무효화된다.
- `agentGuidance: false`: Turborepo는 AI 에이전트를 감지하면 저장소 루트에 `AGENTS.md`를 만든다. 원하지 않는 파일이라 끈다(설치된 패키지의 문서와 `schema.json`에서 옵션 존재를 확인했다).
- 텔레메트리는 `yarn verify`가 `TURBO_TELEMETRY_DISABLED=1`로 끈다.

## 시험으로 확인한 것 (2026-10-08)

**속도.** 첫 실행(캐시 없음) 약 14초, 같은 입력으로 다시 실행하면 약 0.8초(12개 작업 모두 캐시, `FULL TURBO`).

**캐시가 틀린 결과를 재사용하지 않는지.** 처음에는 `dependsOn` 없이 설정했는데, 플러그인(`plugins/botmng`) 소스를 바꿨더니 그 플러그인을 번들하는 `app`의 `lint`, `test`, **`build`가 모두 옛 캐시를 재사용했다.** Turborepo의 기본 해시는 다른 패키지의 소스 변경을 포함하지 않기 때문이다. 이대로면 플러그인이 깨져도 `app` 쪽 검사가 통과한다. `dependsOn: ["^작업"]`을 넣어 고친 뒤 양방향으로 확인했다.

| 바꾼 것                                   | 다시 실행된 것              | 캐시를 재사용한 것 |
| ----------------------------------------- | --------------------------- | ------------------ |
| `plugins/botmng`(프론트엔드 플러그인)     | `botmng`, `app`, `backend`  | `botmng-backend`   |
| `plugins/botmng-backend`(백엔드 플러그인) | `botmng-backend`, `backend` | `botmng`, `app`    |

`backend`는 프론트엔드 패키지 `app`을 서빙하려고 `app`에 의존하므로(Backstage 구조) 프론트엔드 플러그인이 바뀌면 `backend`도 다시 실행된다. 의도된 동작이다.

## CI

`.github/workflows/ci.yml`의 린트·테스트·빌드 세 단계를 `yarn verify` 하나로 바꿨다. `.turbo` 폴더를 `actions/cache`(커밋 해시로 고정)로 Node 버전별로 저장하고 다음 실행에서 복원한다. 타입 검사(`tsc`)와 서식 검사(`prettier`)는 저장소 전체를 한 번에 보는 명령이라 Turborepo 밖에 그대로 둔다.

## 한계와 솔직한 평가

- 패키지가 4개뿐이라 **절대적인 이득은 작다**(14초가 0.8초). 이 도구의 가치는 패키지와 팀이 훨씬 많을 때 커지고, 여기서는 사용 경험을 쌓고 캐시 무효화의 함정을 직접 확인한 것이 주된 소득이다.
- Backstage의 저장소 단위 명령(`backstage-cli repo build --all`, `yarn lint:all`)은 그대로 남겨 두었고 Turborepo와 병행한다. Docker 이미지는 `yarn build:backend`를 쓰며 이번 변경과 무관하다.
- **원격 캐시는 쓰지 않는다**(Vercel 계정 등 외부 서비스가 필요하다). 캐시는 로컬과 GitHub Actions 캐시에만 있다.
- 캐시된 `test`는 입력이 같으면 실행하지 않고 이전 결과를 재생한다. 외부 상태(네트워크, 시간)에 의존하는 테스트가 생기면 캐시가 부적절해질 수 있다. 지금 테스트는 모두 그런 의존이 없다.
- Nx는 쓰지 않았다.
