import { BotmngClient, BotmngError } from './botmngClient';
import { failureView, HealthView, toHealthView } from './health';

/**
 * BotMng 상태를 카드·MCP 도구가 함께 쓰는 값으로 만든다. 실패해도 예외를 던지지 않고 상태로 알린다.
 * client 가 없으면(설정 없음) not-configured.
 */
export async function resolveHealth(
  client: Pick<BotmngClient, 'getHealth'> | undefined,
  now: Date,
): Promise<HealthView> {
  if (!client) {
    return failureView(
      'not-configured',
      'BotMng 연동 설정(botmng.baseUrl, botmng.servicePassword)이 없습니다',
      now,
    );
  }
  try {
    return toHealthView(await client.getHealth(), now);
  } catch (err) {
    return err instanceof BotmngError && err.kind !== 'bad-response'
      ? failureView(err.kind, err.message, now)
      : failureView('unreachable', 'BotMng 상태를 확인할 수 없습니다', now);
  }
}
