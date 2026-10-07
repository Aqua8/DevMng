export type CardStatus =
  | 'ok'
  | 'warn'
  | 'error'
  | 'unreachable'
  | 'unauthorized'
  | 'not-configured';

export interface HealthView {
  status: CardStatus;
  /** 사람이 읽는 문제 목록 (BotMng가 준 issues 또는 연동 실패 설명) */
  issues: string[];
  checkedAt: string;
}

const LEVELS = ['ok', 'warn', 'error'] as const;

/** BotMng /api/health 응답에서 카드에 필요한 값만 꺼낸다. 형식이 다르면 error 로 본다. */
export function toHealthView(raw: unknown, now: Date): HealthView {
  const body = (raw ?? {}) as { status?: unknown; issues?: unknown };
  const status = LEVELS.find(l => l === body.status);
  const issues = Array.isArray(body.issues)
    ? body.issues.filter((i): i is string => typeof i === 'string')
    : [];
  if (!status) {
    return {
      status: 'error',
      issues: ['BotMng 응답 형식이 올바르지 않습니다'],
      checkedAt: now.toISOString(),
    };
  }
  return { status, issues, checkedAt: now.toISOString() };
}

/** 연동 자체가 실패했을 때 카드에 보여 줄 값 */
export const failureView = (
  status: Extract<
    CardStatus,
    'unreachable' | 'unauthorized' | 'not-configured'
  >,
  message: string,
  now: Date,
): HealthView => ({ status, issues: [message], checkedAt: now.toISOString() });
