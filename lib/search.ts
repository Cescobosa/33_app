// lib/search.ts
export const normalize = (s?: string | null) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toLowerCase();

export const matches = (text: string | null | undefined, query: string) =>
  normalize(text).includes(normalize(query));
