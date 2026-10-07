# MCP로 DevMng 조회하기

DevMng는 Backstage의 MCP 액션 기능으로 **읽기 전용 도구 2개**를 MCP 서버로 열어 둔다. Claude Code 같은 MCP 클라이언트가 "내 프로젝트 목록과 BotMng 상태가 어때?"를 물어볼 수 있다.

## 도구

| 도구                       | 설명                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `botmng.list-projects`     | 카탈로그의 프로젝트(컴포넌트) 목록과 의존 관계(dependsOn). 이름, 종류, 생명주기, 소유자, 설명, 태그만 돌려준다 |
| `botmng.get-botmng-health` | BotMng의 현재 상태(`ok`/`warn`/`error`/`unreachable`/`unauthorized`/`not-configured`)와 이유                   |

엔드포인트: `http://localhost:7007/api/mcp-actions/v1/devmng`

## 설정

1. 토큰을 만든다 (저장소에 올리지 않는다).
   ```bash
   node -p 'require("crypto").randomBytes(24).toString("base64url")'
   ```
2. `app-config.mcp.example.yaml`을 `app-config.local.yaml`로 복사한다. `app-config.local.yaml`은 git에서 제외되고 자동으로 읽힌다.
3. 포털을 실행할 때 환경 변수로 넘긴다.
   ```bash
   MCP_TOKEN=... BOTMNG_URL=... BOTMNG_SERVICE_PASSWORD=... yarn start
   ```
4. Claude Code에 연결한다.
   ```bash
   claude mcp add --transport http devmng http://localhost:7007/api/mcp-actions/v1/devmng \
     --header "Authorization: Bearer $MCP_TOKEN"
   ```

## 안전하게 열어 둔 방식

AI에게 도구를 열 때는 "무엇을 못 하게 막았는가"가 중요하다.

- **읽기 전용만 노출**: 서버 설정(`mcpActions.servers.devmng.filter`)이 `readOnly: true`인 액션만 통과시킨다. 노출할 액션을 내는 플러그인도 `botmng` 하나뿐이다(`backend.actions.pluginSources`).
- **카탈로그 액션은 열지 않음**: Backstage 카탈로그의 액션에는 엔티티를 **등록·삭제·새로고침**하는 것이 포함되어 있다. 그대로 열면 AI가 카탈로그를 바꿀 수 있어서 `catalog`는 노출 대상에서 뺐다. 목록 조회는 `botmng` 플러그인의 `list-projects`가 **자기 권한으로 카탈로그를 읽어** 대신 한다.
- **토큰 접근 범위 제한**: MCP용 정적 토큰은 `mcp-actions`와 `botmng` 플러그인에만 접근할 수 있다(`accessRestrictions`). 확인한 결과: 토큰 없음/틀린 토큰은 401, 이 토큰으로 카탈로그 읽기·쓰기·삭제와 scaffolder 호출은 모두 403이다.
- **민감 정보 제외**: `list-projects`는 주석(annotations)과 링크를 돌려주지 않고, `get-botmng-health`는 BotMng 주소와 서비스 계정 비밀번호를 포함하지 않는다.

## 왜 `permissionAttribute`를 쓰지 않았나

카탈로그를 읽기 권한(`permissionAttribute: action: read`)으로만 열어 보았지만, 이 제한이 걸린 토큰은 MCP 플러그인이 카탈로그로 위임 호출을 할 수 없어("restricted and cannot be delegated") 카탈로그 도구가 아예 비었다. 그래서 카탈로그 접근을 토큰에서 빼고 `botmng` 플러그인이 대신 읽는 구조로 바꿨다.

## 확인 방법

MCP 클라이언트 없이도 JSON-RPC로 확인할 수 있다.

```bash
curl -s -X POST http://localhost:7007/api/mcp-actions/v1/devmng \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 실제 Claude Code로 확인 (2026-10-07)

`claude -p`에 일회용 설정을 넘겨, 내 Claude 설정(`~/.claude.json`)을 바꾸지 않고 확인했다. `--strict-mcp-config`가 다른 MCP 서버를 모두 끈다.

```bash
claude -p "devmng MCP 서버의 도구만 사용해서 프로젝트 목록과 BotMng 상태를 알려줘" \
  --mcp-config ./claude-mcp-once.json --strict-mcp-config \
  --allowedTools mcp__devmng --max-budget-usd 0.60 --no-session-persistence
```

`claude-mcp-once.json`은 `{"mcpServers":{"devmng":{"type":"http","url":"http://127.0.0.1:7007/api/mcp-actions/v1/devmng","headers":{"Authorization":"Bearer <MCP_TOKEN>"}}}}` 형식이다. 토큰이 들어 있으므로 저장소에 올리지 않고 쓴 뒤 지운다.

결과: Claude Code가 `botmng.list-projects`와 `botmng.get-botmng-health` 두 도구를 호출해 프로젝트 3개와 BotMng → ScheduleAlertBot 의존 관계, BotMng 상태 `ok`를 올바르게 가져왔다. 권한 거부는 없었고(4턴, 약 0.09달러), 도구 이름은 Claude Code에서 `mcp__devmng__botmng_list-projects`처럼 보인다.
