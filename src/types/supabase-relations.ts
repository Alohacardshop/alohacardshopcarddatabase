export const TABLES = ['cards', 'sets', 'games', 'sync_jobs', 'user_roles', 'variants'] as const;
export const VIEWS = ['popular_cards', 'database_stats'] as const;

export type TableName = typeof TABLES[number];
export type ViewName = typeof VIEWS[number];
export type Relation = TableName | ViewName;

export const isRelation = (s: string): s is Relation =>
  (TABLES as readonly string[]).includes(s) || (VIEWS as readonly string[]).includes(s);