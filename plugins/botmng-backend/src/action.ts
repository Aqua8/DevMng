import type { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { BotmngClient } from './botmngClient';
import { CARD_STATUSES, resolveHealth } from './health';

/**
 * MCP 도구로 노출되는 액션: BotMng 상태 조회.
 * 읽기 전용이고 입력이 없다. 서비스 계정 비밀번호와 주소는 결과에 들어가지 않는다.
 */
export function registerHealthAction(
  actionsRegistry: ActionsRegistryService,
  client: BotmngClient | undefined,
  now: () => Date = () => new Date(),
) {
  actionsRegistry.register({
    name: 'get-botmng-health',
    title: 'BotMng 상태 조회',
    description:
      'BotMng(비서 봇 로그 관제 서비스)의 현재 상태를 조회한다. status 는 ok, warn, error, ' +
      'unreachable(연결 불가), unauthorized(인증 실패), not-configured(설정 없음) 중 하나이고, ' +
      'issues 에 문제의 이유가 들어 있다. 읽기 전용이다.',
    attributes: { readOnly: true, destructive: false, idempotent: true },
    schema: {
      input: z => z.object({}),
      output: z =>
        z.object({
          status: z.enum(CARD_STATUSES),
          issues: z.array(z.string()),
          checkedAt: z.string(),
        }),
    },
    action: async () => ({ output: await resolveHealth(client, now()) }),
  });
}
