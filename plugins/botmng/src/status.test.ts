import { describeStatus, parseHealth } from './status';

describe('describeStatus', () => {
  it('상태를 한국어 이름과 색으로 바꾼다', () => {
    expect(describeStatus('ok')).toEqual({ label: '정상', tone: 'ok' });
    expect(describeStatus('warn')).toEqual({ label: '주의', tone: 'warn' });
    expect(describeStatus('unreachable')).toEqual({
      label: '연결 불가',
      tone: 'error',
    });
    expect(describeStatus('not-configured').tone).toBe('muted');
  });
  it('모르는 값은 오류로 본다', () => {
    expect(describeStatus('???')).toEqual({
      label: '알 수 없음',
      tone: 'error',
    });
  });
});

describe('parseHealth', () => {
  const ok = {
    status: 'ok',
    issues: ['a'],
    checkedAt: '2026-10-07T00:00:00.000Z',
  };
  it('올바른 응답은 그대로 돌려준다', () => {
    expect(parseHealth(ok)).toEqual(ok);
  });
  it('문자열이 아닌 issues 항목은 거른다', () => {
    expect(parseHealth({ ...ok, issues: ['a', 1] })?.issues).toEqual(['a']);
  });
  it('모양이 다르면 undefined', () => {
    expect(parseHealth(null)).toBeUndefined();
    expect(parseHealth({ status: 'ok' })).toBeUndefined();
    expect(parseHealth({ ...ok, issues: 'x' })).toBeUndefined();
  });
});
