/** 백엔드 플러그인(/api/botmng/health)이 돌려주는 상태 */
export type CardStatus =
  | 'ok'
  | 'warn'
  | 'error'
  | 'unreachable'
  | 'unauthorized'
  | 'not-configured';

export interface HealthResponse {
  status: CardStatus;
  issues: string[];
  checkedAt: string;
}

/** 카드의 색(ok=초록, warn=노랑, error=빨강, muted=회색) */
export type Tone = 'ok' | 'warn' | 'error' | 'muted';

const TABLE: Record<CardStatus, { label: string; tone: Tone }> = {
  ok: { label: '정상', tone: 'ok' },
  warn: { label: '주의', tone: 'warn' },
  error: { label: '오류', tone: 'error' },
  unreachable: { label: '연결 불가', tone: 'error' },
  unauthorized: { label: '인증 실패', tone: 'error' },
  'not-configured': { label: '설정 없음', tone: 'muted' },
};

/** 상태를 한국어 이름과 색으로 바꾼다. 모르는 값은 오류로 본다. */
export function describeStatus(status: string): { label: string; tone: Tone } {
  return TABLE[status as CardStatus] ?? { label: '알 수 없음', tone: 'error' };
}

/** 응답이 카드가 기대하는 모양인지 확인한다. 아니면 undefined. */
export function parseHealth(raw: unknown): HealthResponse | undefined {
  const body = raw as Partial<HealthResponse> | null;
  if (
    !body ||
    typeof body.status !== 'string' ||
    !Array.isArray(body.issues) ||
    typeof body.checkedAt !== 'string'
  ) {
    return undefined;
  }
  return {
    status: body.status,
    issues: body.issues.filter((i): i is string => typeof i === 'string'),
    checkedAt: body.checkedAt,
  };
}
