// GÜVENLİ FORMÜL DİLİ — hesaplanmış alanlar için tokenizer + recursive-descent parser + SQL üretici.
// Kullanıcı ham SQL yazmaz: yalnız sayı, ölçü referansı ([amount_usd] veya amount_usd), + - * /,
// karşılaştırma (yalnız IF içinde) ve aşağıdaki beyaz listeli fonksiyonlar.
//
//   IF(koşul, a, b)      ABS(x)      ROUND(x[, basamak 0-6])     COALESCE(x, y)
//   DIV(a, b)  güvenli bölme            PCT(a, b)  = 100·a/b         GROWTH(a, b) = 100·(a−b)/b
//   SUM(x) / AVG(x) / MIN(x) / MAX(x)   sonuç kümesi geneli (window over ())
//   RUNNING_SUM(x) / CUMULATIVE(x)       kırılım sırasına göre kümülatif toplam
//   RANK(x)                              büyükten küçüğe sıra      SHARE(x) = 100·x / SUM(x)
//
// `/` her zaman güvenli bölmedir (nullif(…,0)). Pencere fonksiyonları iç içe kullanılamaz.

export type FormulaNode =
  | { t: 'num'; v: number }
  | { t: 'ref'; key: string }
  | { t: 'neg'; e: FormulaNode }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; l: FormulaNode; r: FormulaNode }
  | { t: 'cmp'; op: '>' | '<' | '>=' | '<=' | '=' | '!='; l: FormulaNode; r: FormulaNode }
  | { t: 'fn'; name: FormulaFn; args: FormulaNode[] };

export const FORMULA_FUNCTIONS = {
  IF: { min: 3, max: 3, window: false },
  ABS: { min: 1, max: 1, window: false },
  ROUND: { min: 1, max: 2, window: false },
  COALESCE: { min: 2, max: 2, window: false },
  DIV: { min: 2, max: 2, window: false },
  PCT: { min: 2, max: 2, window: false },
  GROWTH: { min: 2, max: 2, window: false },
  SUM: { min: 1, max: 1, window: true },
  AVG: { min: 1, max: 1, window: true },
  MIN: { min: 1, max: 1, window: true },
  MAX: { min: 1, max: 1, window: true },
  RUNNING_SUM: { min: 1, max: 1, window: true },
  CUMULATIVE: { min: 1, max: 1, window: true },
  RANK: { min: 1, max: 1, window: true },
  SHARE: { min: 1, max: 1, window: true },
} as const;
export type FormulaFn = keyof typeof FORMULA_FUNCTIONS;

export class FormulaError extends Error {
  constructor(message: string, public position?: number) {
    super(position === undefined ? message : `${message} (konum ${position + 1})`);
  }
}

type Tok =
  | { k: 'num'; v: number; p: number }
  | { k: 'id'; v: string; p: number }
  | { k: 'ref'; v: string; p: number }
  | { k: 'op'; v: string; p: number };

const MAX_LEN = 500;
const MAX_NODES = 200;
const MAX_DEPTH = 24;

export function tokenize(src: string): Tok[] {
  if (src.length > MAX_LEN) throw new FormulaError(`Formül en fazla ${MAX_LEN} karakter olabilir`);
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+(\.\d+)?|\.\d+)/.exec(src.slice(i));
      if (!m) throw new FormulaError('Geçersiz sayı', i);
      out.push({ k: 'num', v: Number(m[0]), p: i });
      i += m[0].length;
      continue;
    }
    if (c === '[') {
      const m = /^\[([a-z][a-z0-9_]{0,63})\]/.exec(src.slice(i));
      if (!m) throw new FormulaError('Geçersiz alan referansı — [olcu_anahtari] biçimi', i);
      out.push({ k: 'ref', v: m[1], p: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]{0,63}/.exec(src.slice(i))!;
      out.push({ k: 'id', v: m[0], p: i });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '--' || two === '/*') throw new FormulaError('Yorum işaretine izin verilmez', i);
    if (['>=', '<=', '!=', '<>'].includes(two)) { out.push({ k: 'op', v: two === '<>' ? '!=' : two, p: i }); i += 2; continue; }
    if ('+-*/(),<>='.includes(c)) { out.push({ k: 'op', v: c, p: i }); i++; continue; }
    // Tırnak, noktalı virgül, yorum vb. her şey reddedilir.
    throw new FormulaError(`İzin verilmeyen karakter '${c}'`, i);
  }
  return out;
}

export function parseFormula(src: string): FormulaNode {
  const toks = tokenize(src);
  if (!toks.length) throw new FormulaError('Formül boş');
  let pos = 0;
  let nodes = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.k === 'op' && peek()!.v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`'${v}' bekleniyor`, peek()?.p ?? src.length);
    pos++;
  };
  const mk = <T extends FormulaNode>(n: T): T => {
    if (++nodes > MAX_NODES) throw new FormulaError('Formül çok karmaşık');
    return n;
  };

  function arg(depth: number): FormulaNode {
    const l = expr(depth);
    const t = peek();
    if (t?.k === 'op' && ['>', '<', '>=', '<=', '=', '!='].includes(t.v)) {
      pos++;
      return mk({ t: 'cmp', op: t.v as any, l, r: expr(depth) });
    }
    return l;
  }
  function expr(depth: number): FormulaNode {
    if (depth > MAX_DEPTH) throw new FormulaError('Formül çok derin');
    let l = term(depth);
    while (isOp('+') || isOp('-')) {
      const op = toks[pos++].v as '+' | '-';
      l = mk({ t: 'bin', op, l, r: term(depth) });
    }
    return l;
  }
  function term(depth: number): FormulaNode {
    let l = factor(depth);
    while (isOp('*') || isOp('/')) {
      const op = toks[pos++].v as '*' | '/';
      l = mk({ t: 'bin', op, l, r: factor(depth) });
    }
    return l;
  }
  function factor(depth: number): FormulaNode {
    if (isOp('-')) { pos++; return mk({ t: 'neg', e: factor(depth + 1) }); }
    if (isOp('+')) { pos++; return factor(depth + 1); }
    return primary(depth);
  }
  function primary(depth: number): FormulaNode {
    const t = peek();
    if (!t) throw new FormulaError('Formül eksik bitti', src.length);
    if (t.k === 'num') { pos++; return mk({ t: 'num', v: t.v }); }
    if (t.k === 'ref') { pos++; return mk({ t: 'ref', key: t.v }); }
    if (t.k === 'op' && t.v === '(') {
      pos++;
      const e = expr(depth + 1);
      expectOp(')');
      return e;
    }
    if (t.k === 'id') {
      pos++;
      const upper = t.v.toUpperCase();
      if (isOp('(')) {
        if (!Object.prototype.hasOwnProperty.call(FORMULA_FUNCTIONS, upper)) throw new FormulaError(`Bilinmeyen fonksiyon: ${t.v}`, t.p);
        pos++;
        const args: FormulaNode[] = [];
        if (!isOp(')')) {
          args.push(arg(depth + 1));
          while (isOp(',')) { pos++; args.push(arg(depth + 1)); }
        }
        expectOp(')');
        const spec = FORMULA_FUNCTIONS[upper as FormulaFn];
        if (args.length < spec.min || args.length > spec.max) throw new FormulaError(`${upper}: ${spec.min === spec.max ? spec.min : `${spec.min}-${spec.max}`} argüman bekleniyor`, t.p);
        return mk({ t: 'fn', name: upper as FormulaFn, args });
      }
      if (!/^[a-z][a-z0-9_]*$/.test(t.v)) throw new FormulaError(`Geçersiz alan: ${t.v}`, t.p);
      return mk({ t: 'ref', key: t.v });
    }
    throw new FormulaError(`Beklenmeyen '${t.v}'`, t.p);
  }

  const root = expr(0);
  if (pos < toks.length) throw new FormulaError(`Beklenmeyen '${toks[pos].v}'`, toks[pos].p);
  validate(root, false, false);
  return root;
}

function validate(n: FormulaNode, inWindow: boolean, allowCmp: boolean): void {
  switch (n.t) {
    case 'num': case 'ref': return;
    case 'neg': return validate(n.e, inWindow, false);
    case 'bin': validate(n.l, inWindow, false); validate(n.r, inWindow, false); return;
    case 'cmp':
      if (!allowCmp) throw new FormulaError('Karşılaştırma yalnız IF koşulunda kullanılabilir');
      validate(n.l, inWindow, false); validate(n.r, inWindow, false); return;
    case 'fn': {
      const spec = FORMULA_FUNCTIONS[n.name];
      if (spec.window && inWindow) throw new FormulaError(`${n.name}: pencere fonksiyonları iç içe kullanılamaz`);
      if (n.name === 'ROUND' && n.args[1] && !(n.args[1].t === 'num' && Number.isInteger(n.args[1].v) && n.args[1].v <= 6)) {
        throw new FormulaError('ROUND: basamak 0-6 arası tam sayı olmalı');
      }
      n.args.forEach((a, i) => validate(a, inWindow || spec.window, n.name === 'IF' && i === 0));
      if (n.name === 'IF' && n.args[0].t !== 'cmp') throw new FormulaError('IF: ilk argüman karşılaştırma olmalı (ör. [a] > 0)');
      return;
    }
  }
}

export function formulaRefs(n: FormulaNode, acc = new Set<string>()): Set<string> {
  if (n.t === 'ref') acc.add(n.key);
  else if (n.t === 'neg') formulaRefs(n.e, acc);
  else if (n.t === 'bin' || n.t === 'cmp') { formulaRefs(n.l, acc); formulaRefs(n.r, acc); }
  else if (n.t === 'fn') n.args.forEach((a) => formulaRefs(a, acc));
  return acc;
}

export type FormulaSqlContext = {
  /** Ölçü anahtarı → toplulaştırılmış SQL (registry). Bilinmiyorsa hata fırlatmalı. */
  measureSql: (key: string) => string;
  /** RUNNING_SUM için sıralama ifadeleri (kırılım SQL'leri). Boşsa kümülatif = toplam. */
  orderBy: string[];
};

const num = (s: string) => `(${s})::numeric`;

export function formulaToSql(n: FormulaNode, ctx: FormulaSqlContext): string {
  const go = (x: FormulaNode): string => formulaToSql(x, ctx);
  switch (n.t) {
    case 'num': return `(${String(n.v)})::numeric`;
    case 'ref': return num(ctx.measureSql(n.key));
    case 'neg': return `(-${go(n.e)})`;
    case 'bin':
      if (n.op === '/') return `(${go(n.l)} / nullif(${go(n.r)}, 0))`;
      return `(${go(n.l)} ${n.op} ${go(n.r)})`;
    case 'cmp': return `(${go(n.l)} ${n.op === '!=' ? '<>' : n.op} ${go(n.r)})`;
    case 'fn': {
      const a = n.args.map(go);
      const order = ctx.orderBy.length ? `order by ${ctx.orderBy.join(', ')}` : '';
      switch (n.name) {
        case 'IF': return `(case when ${a[0]} then ${a[1]} else ${a[2]} end)`;
        case 'ABS': return `abs(${a[0]})`;
        case 'ROUND': return `round(${a[0]}, ${n.args[1] ? String((n.args[1] as { v: number }).v) : '0'})`;
        case 'COALESCE': return `coalesce(${a[0]}, ${a[1]})`;
        case 'DIV': return `(${a[0]} / nullif(${a[1]}, 0))`;
        case 'PCT': return `(100.0 * ${a[0]} / nullif(${a[1]}, 0))`;
        case 'GROWTH': return `(100.0 * (${a[0]} - ${a[1]}) / nullif(${a[1]}, 0))`;
        case 'SUM': return `sum(${a[0]}) over ()`;
        case 'AVG': return `avg(${a[0]}) over ()`;
        case 'MIN': return `min(${a[0]}) over ()`;
        case 'MAX': return `max(${a[0]}) over ()`;
        case 'RUNNING_SUM':
        case 'CUMULATIVE': return `sum(${a[0]}) over (${order} rows between unbounded preceding and current row)`;
        case 'RANK': return `rank() over (order by ${a[0]} desc nulls last)`;
        case 'SHARE': return `(100.0 * ${a[0]} / nullif(sum(${a[0]}) over (), 0))`;
      }
    }
  }
}
