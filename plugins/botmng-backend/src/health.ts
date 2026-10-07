import { BotmngClient, BotmngError } from './botmngClient';
import { stringsOnly } from './util';

/** BotMng 가 /api/health 로 알려 주는 상태 */
export const BOTMNG_LEVELS = ['ok', 'warn', 'error'] as const;

/**
 * 카드와 MCP 도구가 쓰는 상태 전체 (BotMng 상태 + 연동 실패).
 * 새 상태를 더하면 프론트엔드 plugins/botmng/src/status.ts 의 CardStatus 와 TABLE 도 함께 고친다
 * (두 패키지가 따로 선언해서 빠뜨려도 컴파일은 통과하고, 카드에는 '알 수 없음'으로 보인다).
 */
export const CARD_STATUSES = [
  ...BOTMNG_LEVELS,
  'unreachable',
  'unauthorized',
  'not-configured',
] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

export interface HealthView {
  status: CardStatus;
  /** 사람이 읽는 문제 목록 (BotMng가 준 issues 또는 연동 실패 설명) */
  issues: string[];
  checkedAt: string;
}

/** MCP 로 LLM 에 그대로 전달되므로 issues 의 개수와 길이를 제한한다 (BotMng 가 나중에 긴 내용을 보내도 안전하도록) */
const MAX_ISSUES = 20;
const MAX_ISSUE_LENGTH = 200;

const view = (status: CardStatus, issues: string[], now: Date): HealthView => ({
  status,
  issues,
  checkedAt: now.toISOString(),
});

/** BotMng /api/health 응답에서 카드에 필요한 값만 꺼낸다. 형식이 다르면 error 로 본다. */
export function toHealthView(raw: unknown, now: Date): HealthView {
  const body = (raw ?? {}) as { status?: unknown; issues?: unknown };
  const status = BOTMNG_LEVELS.find(l => l === body.status);
  return status
    ? view(
        status,
        stringsOnly(body.issues)
          .slice(0, MAX_ISSUES)
          .map(i => i.slice(0, MAX_ISSUE_LENGTH)),
        now,
      )
    : view('error', ['BotMng 응답 형식이 올바르지 않습니다'], now);
}

/**
 * BotMng 상태를 카드·MCP 도구가 함께 쓰는 값으로 만든다. 실패해도 예외를 던지지 않고 상태로 알린다.
 * client 가 없으면(설정 없음) not-configured.
 */
export async function resolveHealth(
  client: Pick<BotmngClient, 'getHealth'> | undefined,
  now: Date,
): Promise<HealthView> {
  if (!client) {
    return view(
      'not-configured',
      ['BotMng 연동 설정(botmng.baseUrl, botmng.servicePassword)이 없습니다'],
      now,
    );
  }
  try {
    return toHealthView(await client.getHealth(), now);
  } catch (err) {
    // bad-response(5xx, 형식 오류)는 원인을 알리지 않고 "확인할 수 없음"으로 본다
    return err instanceof BotmngError && err.kind !== 'bad-response'
      ? view(err.kind, [err.message], now)
      : view('unreachable', ['BotMng 상태를 확인할 수 없습니다'], now);
  }
}
