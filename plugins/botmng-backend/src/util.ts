/** 배열에서 문자열 항목만 남긴다. 배열이 아니면 빈 배열. */
export const stringsOnly = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
