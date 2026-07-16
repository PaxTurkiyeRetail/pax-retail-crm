import { db } from '@/lib/db';
import { getSessionTokenFromCookies, getUserBySessionToken } from '@/lib/auth';

type Row = Record<string, any>;
type Filter =
  | { kind: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike'; column: string; value: any }
  | { kind: 'in'; column: string; value: any[] }
  | { kind: 'is'; column: string; value: any }
  | { kind: 'not'; column: string; operator: string; value: any }
  | { kind: 'or'; value: string }
  | { kind: 'match'; value: Record<string, any> };

type Order = { column: string; ascending: boolean };

type QueryMode = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

function quoteIdent(identifier: string) {
  return identifier
    .split('.')
    .map((part) => `"${String(part).replace(/"/g, '""')}"`)
    .join('.');
}

function splitTopLevel(input: string) {
  const out: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseSelectColumns(selectClause: string | undefined) {
  if (!selectClause || selectClause.trim() === '*' || selectClause.trim() === '') {
    return { columnsSql: '*', nested: [] as string[] };
  }

  const items = splitTopLevel(selectClause);
  const simple: string[] = [];
  const nested: string[] = [];

  for (const item of items) {
    if (item.includes('(')) nested.push(item);
    else simple.push(item);
  }

  const columnsSql = simple.length
    ? simple.map((c) => quoteIdent(c.trim())).join(', ')
    : '*';

  return { columnsSql, nested };
}

function parseRelationSpec(spec: string) {
  const match = spec.match(/^([a-zA-Z0-9_]+)\((.+)\)$/);
  if (!match) return null;
  return { relation: match[1], columns: splitTopLevel(match[2]).map((s) => s.trim()).filter(Boolean) };
}

function unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

async function attachNestedRelations(baseTable: string, rows: Row[], nestedSpecs: string[]) {
  if (!rows.length || !nestedSpecs.length) return rows;

  for (const spec of nestedSpecs) {
    const parsed = parseRelationSpec(spec);
    if (!parsed) continue;
    const { relation, columns } = parsed;

    // Support only the patterns used in this project.
    if (baseTable === 'requests' && relation === 'request_categories') {
      const ids = unique(rows.map((r) => r.category_id).filter(Boolean));
      if (!ids.length) {
        rows.forEach((r) => { r[relation] = null; });
        continue;
      }
      const sql = `select id, ${columns.map(quoteIdent).join(', ')} from public.request_categories where id = any($1)`;
      const res = await db.query(sql, [ids]);
      const map = new Map(res.rows.map((r) => [r.id, Object.fromEntries(columns.map((c) => [c, r[c]]))]));
      rows.forEach((r) => { r[relation] = r.category_id ? map.get(r.category_id) ?? null : null; });
      continue;
    }

    if (baseTable === 'pipeline_eventleri' && relation === 'musteriler') {
      const ids = unique(rows.map((r) => r.musteri_id).filter(Boolean));
      if (!ids.length) {
        rows.forEach((r) => { r[relation] = null; });
        continue;
      }
      const selected = unique(['id', ...columns]).map(quoteIdent).join(', ');
      const sql = `select ${selected} from public.musteriler where id = any($1)`;
      const res = await db.query(sql, [ids]);
      const map = new Map(res.rows.map((r) => [r.id, Object.fromEntries(columns.map((c) => [c, r[c]]))]));
      rows.forEach((r) => { r[relation] = r.musteri_id ? map.get(r.musteri_id) ?? null : null; });
      continue;
    }
  }

  return rows;
}

class QueryBuilder {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private _limit?: number;
  private _range?: { from: number; to: number };
  private _select = '*';
  private _countExact = false;
  private _single = false;
  private _maybeSingle = false;
  private _insertValues: Row[] = [];
  private _updateValues: Row | null = null;
  private _upsertValues: Row[] = [];
  private _upsertConflict?: string;

  constructor(private table: string, private mode: QueryMode = 'select') {}

  select(columns = '*', options?: { count?: 'exact' | null }) {
    this._select = columns;
    if (options?.count === 'exact') this._countExact = true;
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = 'insert';
    this._insertValues = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: Row) {
    this.mode = 'update';
    this._updateValues = values;
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = 'upsert';
    this._upsertValues = Array.isArray(values) ? values : [values];
    this._upsertConflict = options?.onConflict;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: any) { this.filters.push({ kind: 'eq', column, value }); return this; }
  neq(column: string, value: any) { this.filters.push({ kind: 'neq', column, value }); return this; }
  gt(column: string, value: any) { this.filters.push({ kind: 'gt', column, value }); return this; }
  gte(column: string, value: any) { this.filters.push({ kind: 'gte', column, value }); return this; }
  lt(column: string, value: any) { this.filters.push({ kind: 'lt', column, value }); return this; }
  lte(column: string, value: any) { this.filters.push({ kind: 'lte', column, value }); return this; }
  in(column: string, value: any[]) { this.filters.push({ kind: 'in', column, value }); return this; }
  is(column: string, value: any) { this.filters.push({ kind: 'is', column, value }); return this; }
  ilike(column: string, value: any) { this.filters.push({ kind: 'ilike', column, value }); return this; }
  or(value: string) { this.filters.push({ kind: 'or', value }); return this; }
  match(value: Record<string, any>) { this.filters.push({ kind: 'match', value }); return this; }
  not(column: string, operator: string, value: any) { this.filters.push({ kind: 'not', column, operator, value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this._limit = value; return this; }
  range(from: number, to: number) { this._range = { from, to }; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  private buildWhere(startIndex = 1) {
    const clauses: string[] = [];
    const params: any[] = [];
    let index = startIndex;
    for (const filter of this.filters) {
      if (filter.kind === 'match') {
        for (const [column, value] of Object.entries(filter.value)) {
          clauses.push(`${quoteIdent(column)} = $${index++}`);
          params.push(value);
        }
        continue;
      }
      if (filter.kind === 'or') {
        const parts = String(filter.value)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((piece) => {
            const m = piece.match(/^([a-zA-Z0-9_]+)\.(ilike|eq)\.(.+)$/i);
            if (!m) return null;
            const [, col, op, rawVal] = m;
            const value = rawVal.replace(/^%/, '').replace(/%$/, '');
            params.push(op.toLowerCase() === 'ilike' ? `%${value}%` : value);
            const p = `$${index++}`;
            return `${quoteIdent(col)} ${op.toLowerCase() === 'ilike' ? 'ILIKE' : '='} ${p}`;
          })
          .filter(Boolean);
        if (parts.length) clauses.push(`(${parts.join(' OR ')})`);
        continue;
      }
      if (filter.kind === 'eq') { clauses.push(`${quoteIdent(filter.column)} = $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'neq') { clauses.push(`${quoteIdent(filter.column)} <> $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'gt') { clauses.push(`${quoteIdent(filter.column)} > $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'gte') { clauses.push(`${quoteIdent(filter.column)} >= $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'lt') { clauses.push(`${quoteIdent(filter.column)} < $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'lte') { clauses.push(`${quoteIdent(filter.column)} <= $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'ilike') { clauses.push(`${quoteIdent(filter.column)} ILIKE $${index++}`); params.push(filter.value); continue; }
      if (filter.kind === 'in') { clauses.push(`${quoteIdent(filter.column)} = ANY($${index++})`); params.push(filter.value); continue; }
      if (filter.kind === 'is') {
        if (filter.value === null) clauses.push(`${quoteIdent(filter.column)} IS NULL`);
        else clauses.push(`${quoteIdent(filter.column)} IS NOT DISTINCT FROM $${index++}`), params.push(filter.value);
        continue;
      }
      if (filter.kind === 'not') {
        const op = String(filter.operator).toLowerCase();
        if (op === 'is' && filter.value === null) clauses.push(`${quoteIdent(filter.column)} IS NOT NULL`);
        else if (op === 'eq') { clauses.push(`${quoteIdent(filter.column)} <> $${index++}`); params.push(filter.value); }
        continue;
      }
    }
    return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params, nextIndex: index };
  }

  private buildOrderAndPaging() {
    const orderSql = this.orders.length
      ? ` ORDER BY ${this.orders.map((o) => `${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`
      : '';
    let limitSql = '';
    if (this._range) {
      const limit = this._range.to - this._range.from + 1;
      limitSql = ` LIMIT ${Math.max(0, limit)} OFFSET ${Math.max(0, this._range.from)}`;
    } else if (typeof this._limit === 'number') {
      limitSql = ` LIMIT ${this._limit}`;
    }
    return `${orderSql}${limitSql}`;
  }

  async execute() {
    try {
      if (this.mode === 'insert' || this.mode === 'upsert') {
        const rows = this.mode === 'insert' ? this._insertValues : this._upsertValues;
        if (!rows.length) return { data: [], error: null, count: 0 };
        const cols = unique(rows.flatMap((r) => Object.keys(r)));
        const params: any[] = [];
        const valuesSql = rows.map((row) => {
          const vals = cols.map((c) => row[c] ?? null);
          const slots = vals.map((v) => { params.push(v); return `$${params.length}`; });
          return `(${slots.join(', ')})`;
        }).join(', ');
        const colSql = cols.map(quoteIdent).join(', ');
        const conflict = this.mode === 'upsert' && this._upsertConflict
          ? ` ON CONFLICT (${this._upsertConflict.split(',').map((c) => quoteIdent(c.trim())).join(', ')}) DO UPDATE SET ${cols.filter((c) => !this._upsertConflict?.split(',').map((s) => s.trim()).includes(c)).map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(', ') || `${quoteIdent(this._upsertConflict.trim())} = EXCLUDED.${quoteIdent(this._upsertConflict.trim())}`}`
          : '';
        const { columnsSql, nested } = parseSelectColumns(this._select);
        const returning = this._select ? ` RETURNING ${columnsSql === '*' ? '*' : columnsSql}` : ' RETURNING *';
        const sql = `INSERT INTO public.${quoteIdent(this.table)} (${colSql}) VALUES ${valuesSql}${conflict}${returning}`;
        const res = await db.query(sql, params);
        let data = res.rows;
        if (nested.length) data = await attachNestedRelations(this.table, data, nested);
        if (this._single) data = data[0] ?? null;
        if (this._maybeSingle) data = data[0] ?? null;
        return { data, error: null, count: Array.isArray(data) ? data.length : data ? 1 : 0 };
      }

      if (this.mode === 'update') {
        const payload = this._updateValues ?? {};
        const keys = Object.keys(payload);
        const params: any[] = [];
        const setSql = keys.map((k) => { params.push(payload[k]); return `${quoteIdent(k)} = $${params.length}`; }).join(', ');
        const where = this.buildWhere(params.length + 1);
        const { columnsSql, nested } = parseSelectColumns(this._select);
        const returning = ` RETURNING ${columnsSql === '*' ? '*' : columnsSql}`;
        const sql = `UPDATE public.${quoteIdent(this.table)} SET ${setSql}${where.sql}${returning}`;
        const res = await db.query(sql, [...params, ...where.params]);
        let data: any = res.rows;
        if (nested.length && Array.isArray(data)) data = await attachNestedRelations(this.table, data, nested);
        if (this._single) data = data[0] ?? null;
        if (this._maybeSingle) data = data[0] ?? null;
        return { data, error: null, count: Array.isArray(data) ? data.length : data ? 1 : 0 };
      }

      if (this.mode === 'delete') {
        const where = this.buildWhere(1);
        const sql = `DELETE FROM public.${quoteIdent(this.table)}${where.sql} RETURNING *`;
        const res = await db.query(sql, where.params);
        let data: any = res.rows;
        if (this._single) data = data[0] ?? null;
        if (this._maybeSingle) data = data[0] ?? null;
        return { data, error: null, count: Array.isArray(data) ? data.length : data ? 1 : 0 };
      }

      const { columnsSql, nested } = parseSelectColumns(this._select);
      const where = this.buildWhere(1);
      const orderAndPaging = this.buildOrderAndPaging();
      const sql = `SELECT ${columnsSql} FROM public.${quoteIdent(this.table)}${where.sql}${orderAndPaging}`;
      const res = await db.query(sql, where.params);
      let data: any = res.rows;
      if (nested.length && Array.isArray(data)) data = await attachNestedRelations(this.table, data, nested);
      const count = this._countExact
        ? Number((await db.query(`SELECT COUNT(*)::int AS count FROM public.${quoteIdent(this.table)}${where.sql}`, where.params)).rows[0]?.count ?? 0)
        : null;
      if (this._single) {
        if (!data.length) return { data: null, error: { message: 'No rows found' }, count };
        data = data[0];
      }
      if (this._maybeSingle) data = data[0] ?? null;
      return { data, error: null, count };
    } catch (error: any) {
      return { data: null, error: { message: error?.message ?? 'Database error', details: error }, count: null };
    }
  }

  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

export function createPgClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
    auth: {
      async getUser() {
        const token = await getSessionTokenFromCookies();
        if (!token) return { data: { user: null }, error: null };
        const user = await getUserBySessionToken(token);
        if (!user) return { data: { user: null }, error: null };
        return { data: { user: { id: user.id, email: user.email, user_metadata: { full_name: user.full_name }, app_metadata: { role: user.role } } }, error: null };
      },
      admin: {
        async listUsers({ page = 1, perPage = 1000 }: { page?: number; perPage?: number }) {
          try {
            const offset = (page - 1) * perPage;
            const res = await db.query(
              `select id, email, full_name, role, is_active, created_at from public.allowed_users order by created_at desc nulls last, email asc limit $1 offset $2`,
              [perPage, offset]
            );
            return {
              data: {
                users: res.rows.map((r) => ({ id: r.id, email: r.email, user_metadata: { full_name: r.full_name }, app_metadata: { role: r.role }, banned_until: r.is_active ? null : 'infinity' })),
              },
              error: null,
            };
          } catch (error: any) {
            return { data: { users: [] }, error: { message: error?.message ?? 'Database error' } };
          }
        },
        async deleteUser(id: string) {
          try {
            await db.query('delete from public.allowed_users where id = $1', [id]);
            return { data: { user: null }, error: null };
          } catch (error: any) {
            return { data: null, error: { message: error?.message ?? 'Database error' } };
          }
        },
      },
    },
  };
}


export function createPgBrowserClient() {
  return createPgClient();
}

export type PgClient = ReturnType<typeof createPgClient>;
