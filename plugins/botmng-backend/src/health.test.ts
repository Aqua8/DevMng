import { failureView, toHealthView } from './health';

const now = new Date('2026-10-07T00:00:00Z');

describe('toHealthView', () => {
  it('status 와 issues 만 꺼낸다 (다른 값은 버린다)', () => {
    expect(
      toHealthView(
        {
          status: 'warn',
          issues: ['수집이 밀리고 있습니다'],
          db: { size: 1 },
          extra: 'x',
        },
        now,
      ),
    ).toEqual({
      status: 'warn',
      issues: ['수집이 밀리고 있습니다'],
      checkedAt: now.toISOString(),
    });
  });
  it('문자열이 아닌 issues 항목은 거른다', () => {
    expect(
      toHealthView({ status: 'ok', issues: ['a', 1, null] }, now).issues,
    ).toEqual(['a']);
  });
  it('형식이 다르면 error', () => {
    expect(toHealthView({ status: 'great' }, now).status).toBe('error');
    expect(toHealthView(null, now).status).toBe('error');
  });
});

describe('failureView', () => {
  it('연동 실패를 카드용 값으로 바꾼다', () => {
    expect(
      failureView('unreachable', 'BotMng에 연결할 수 없습니다', now),
    ).toEqual({
      status: 'unreachable',
      issues: ['BotMng에 연결할 수 없습니다'],
      checkedAt: now.toISOString(),
    });
  });
});
