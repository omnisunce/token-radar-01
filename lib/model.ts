// Token radar: a value model for pre-token protocols, written from the sealed
// DefiLlama snapshot alone. No names are hardcoded and no network is touched:
// every figure below is derived from the snapshot's own rows.
//
// The model, in one line: a protocol's token, if it ever launches, is worth
// roughly what the tokens of similar protocols already trade for, scaled by
// how fast the protocol is growing, how long it has run without a token, and
// how many chains it runs on.
//
//   implied = TVL x peerMultiple(category) x growth x age x breadth
//
// peerMultiple(category) is the median market-cap-per-TVL of the tokenized
// protocols in the same category, shrunk toward the global median so a
// category with one or two traded peers cannot set a wild multiple on its
// own. A category with no traded peer at all falls back to the global median.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface ScoredRow {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  multiple: number;
  peers: number;
  confidence: 'high' | 'medium' | 'low';
  on_watchlist: boolean;
  farm_steps: string[];
  /** Template keys, in order, that expand to farm_steps (dashboard reuse). */
  step_keys: string[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
}

export interface Comparable {
  slug: string;
  name: string;
  category: string;
  tvl_usd: number;
  mcap_usd: number;
}

export interface Radar {
  meta: {
    as_of: string;
    floor_usd: number;
    rows: number;
    watchlist: number;
    eligible: number;
    total_implied_usd: number;
    global_multiple: number;
  };
  multiples: Record<string, { multiple: number; peers: number }>;
  comparables: Comparable[];
  rows: ScoredRow[];
}

const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_PREFIXES = [
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
];

const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A protocol records a token when DefiLlama names one for it. */
export function hasToken(p: Protocol): boolean {
  return p.gecko_id !== null || p.symbol !== null;
}

/**
 * A wrapped, staked or bridged product of a token that already trades is not
 * a protocol still waiting on a launch of its own. Same rule the snapshot's
 * own watchlist was drawn with, recomputed from the snapshot's fields.
 */
export function isWrappedProduct(p: Protocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (WRAPPED_WORD.test(p.name)) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  const lower = p.name.toLowerCase();
  for (const ex of EXCHANGE_PREFIXES) {
    const e = ex.toLowerCase();
    if (lower === e || lower.startsWith(`${e} `)) return true;
  }
  return false;
}

/** Whole days between two YYYY-MM-DD dates, or null when either is missing. */
export function daysBetween(from: string | null, to: string): number | null {
  if (from === null) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Parse and lightly validate the sealed snapshot. Throws on bad input. */
export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (typeof raw !== 'object' || raw === null) throw new Error('snapshot is not an object');
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot is missing protocols or watchlist');
  }
  if (typeof raw.as_of !== 'string' || typeof raw.floor_usd !== 'number') {
    throw new Error('snapshot is missing as_of or floor_usd');
  }
  for (const p of raw.protocols) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error('snapshot holds a protocol without slug, name or tvl_usd');
    }
    if (!Array.isArray(p.chains)) throw new Error(`snapshot protocol ${p.slug} has no chains array`);
  }
  return raw;
}

// ---------------------------------------------------------------- farm plans

/**
 * Farm-step playbooks. One template per key; {n} is the protocol name and
 * {c} its first chain. Every step carries a cost and a duration, so the plan
 * is something a reader can actually do, not a slogan. The dashboard ships
 * this same table (dashboard/steps.js) and expands the same keys, so the page
 * and the board can never disagree.
 */
export const STEP_TEMPLATES: Record<string, string> = {
  onboard:
    'Set up a fresh wallet on {c}, bridge $50-$200 in, and keep a little native gas aside; never farm from an exchange account.',
  monitor:
    "Track your points weekly, screenshot your balances, and watch {n}'s announcements for a token or snapshot date; unstake only after the snapshot.",
  'dex-1':
    'Swap $25-$100 a week through {n} on {c} across 2-3 different pools; small regular volume beats one big trade for points.',
  'dex-2':
    'Provide $100-$500 of liquidity to a {n} pool for 4+ weeks and keep the LP position receipt as proof of activity.',
  'lend-1':
    'Supply $100-$500 of a blue-chip asset to {n} on {c} and leave it earning for 4-8 weeks; supplied balances usually count most.',
  'lend-2':
    'Borrow a small amount ($20-$50) against your supply once, repay it, and repeat monthly to show real usage.',
  'yield-1':
    "Deposit $100-$300 into {n}'s highest-TVL vault on {c} and hold 4+ weeks; auto-compounding positions usually earn the most points.",
  'yield-2':
    'Try a second vault or strategy on {n} with $25-$50 to widen your footprint without doubling your risk.',
  'rwa-1':
    'Buy $50-$200 of a tokenized asset on {n} on {c} and hold it 4+ weeks; RWA points usually reward holding time, not trading.',
  'rwa-2':
    'If {n} offers a vault or earn product, stake $25-$100 there too and keep the receipt for the airdrop checker.',
  'deriv-1':
    'Open 2-3 small perps positions ($10-$25 each) on {n} on {c} over a month; close them in profit or at a small loss and keep fees low.',
  'deriv-2':
    'Provide liquidity or margin to {n} for 2-4 weeks if it offers a vault; LP-side activity often counts double.',
  'cdp-1':
    "Mint $50-$200 of {n}'s stablecoin against $100-$400 of collateral on {c}; keep the ratio above 200% so you never get liquidated.",
  'cdp-2':
    'Hold the minted stablecoin or LP it for 4+ weeks, then repay the loan in full before any snapshot date.',
  'curator-1':
    'Deposit $100-$500 into a {n} curator vault on {c} and hold 4-8 weeks; curator points usually track deposit size times time.',
  'curator-2':
    'Compare 2-3 {n} vaults, split $50-$100 into a second one, and keep both positions open through the quarter.',
  'alloc-1':
    'Allocate $100-$500 to a {n} strategy on {c} and hold for 6-12 weeks; allocators reward sticky capital, not quick flips.',
  'alloc-2':
    'Rebalance or top up once a month with $25-$50 to show ongoing activity while keeping the main position untouched.',
  'agg-1':
    "Deposit $50-$200 into {n}'s top vault on {c} and let it auto-compound for 4+ weeks.",
  'agg-2':
    'Move $25-$50 into a second {n} strategy after two weeks to broaden your on-chain footprint.',
  'basis-1':
    'Deposit $50-$200 into a {n} basis vault on {c} for 4+ weeks; basis yields accrue slowly, so patience pays.',
  'basis-2':
    "Check the vault's funding-rate report weekly and keep the position through at least one full funding cycle.",
  'generic-1':
    'Use {n} on {c} with $50-$200 for 4+ weeks: deposit, hold, and transact at least once a week.',
  'generic-2':
    'Complete every points or quest task {n} lists, and keep $25-$50 of activity each week so your address stays warm.',
};

/** Which two playbook steps a category farms with. Unknown categories go generic. */
const CATEGORY_STEPS: Record<string, [string, string]> = {
  Dexs: ['dex-1', 'dex-2'],
  Lending: ['lend-1', 'lend-2'],
  Yield: ['yield-1', 'yield-2'],
  RWA: ['rwa-1', 'rwa-2'],
  Derivatives: ['deriv-1', 'deriv-2'],
  CDP: ['cdp-1', 'cdp-2'],
  'Risk Curators': ['curator-1', 'curator-2'],
  'Onchain Capital Allocator': ['alloc-1', 'alloc-2'],
  'Yield Aggregator': ['agg-1', 'agg-2'],
  'Basis Trading': ['basis-1', 'basis-2'],
};

function expandStep(key: string, name: string, chain: string): string {
  const template = STEP_TEMPLATES[key];
  if (template === undefined) throw new Error(`unknown farm-step template ${key}`);
  return template.replaceAll('{n}', name).replaceAll('{c}', chain);
}

// ---------------------------------------------------------------- the board

const BOARD_SIZE = 150;
/** Shrinkage strength: how many phantom peers at the global median each category gets. */
const SHRINK_K = 5;

/**
 * Score every farmable protocol and rank the board. The watchlist is always
 * in: it is the floor the house drew, and the board is built on top of it.
 */
export function buildRadar(snapshot: Snapshot): Radar {
  const ratiosByCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (!hasToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio)) continue;
    const cat = p.category ?? 'Uncategorized';
    const list = ratiosByCategory.get(cat) ?? [];
    list.push(ratio);
    ratiosByCategory.set(cat, list);
    allRatios.push(ratio);
  }
  const globalMultiple = allRatios.length > 0 ? median(allRatios) : 0.2;

  const multiples: Record<string, { multiple: number; peers: number }> = {};
  for (const [cat, ratios] of ratiosByCategory) {
    const shrunk = (ratios.length * median(ratios) + SHRINK_K * globalMultiple) / (ratios.length + SHRINK_K);
    multiples[cat] = { multiple: clamp(shrunk, 0.05, 2), peers: ratios.length };
  }

  const watchlist = new Set(snapshot.watchlist);
  const eligible = snapshot.protocols.filter((p) => !hasToken(p) && !isWrappedProduct(p));

  const scored: ScoredRow[] = eligible.map((p) => {
    const cat = p.category ?? 'Uncategorized';
    const found = multiples[cat];
    const multiple = found !== undefined ? found.multiple : globalMultiple;
    const peers = found !== undefined ? found.peers : 0;
    const growthRaw = p.change_7d ?? 0;
    const growth = 1 + (0.5 * clamp(growthRaw, -30, 100)) / 100;
    const ageDays = daysBetween(p.listed_at, snapshot.as_of);
    const age = ageDays === null ? 1 : 1 + 0.15 * Math.min(Math.log1p(ageDays / 365), 1.5);
    const breadth = 1 + 0.02 * Math.min(Math.max(p.chains.length - 1, 0), 5);
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growth * age * breadth));
    const chain = p.chains[0] ?? 'Ethereum';
    const pair = CATEGORY_STEPS[cat] ?? ['generic-1', 'generic-2'];
    const stepKeys = ['onboard', pair[0], pair[1], 'monitor'];
    const confidence: ScoredRow['confidence'] =
      p.change_7d !== null && p.listed_at !== null && peers >= 3
        ? 'high'
        : (p.change_7d !== null && p.listed_at !== null) || peers >= 3
          ? 'medium'
          : 'low';
    return {
      slug: p.slug,
      name: p.name,
      category: cat,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      age_days: ageDays,
      implied_value_usd: implied,
      multiple,
      peers,
      confidence,
      on_watchlist: watchlist.has(p.slug),
      farm_steps: stepKeys.map((k) => expandStep(k, p.name, chain)),
      step_keys: stepKeys,
    };
  });

  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  const onList = scored.filter((r) => r.on_watchlist);
  const offList = scored.filter((r) => !r.on_watchlist);
  const picked = [...onList, ...offList.slice(0, BOARD_SIZE - onList.length)];
  picked.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  const rows = picked.slice(0, BOARD_SIZE);

  const comparables: Comparable[] = snapshot.protocols
    .filter((p) => hasToken(p) && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 8)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category ?? 'Uncategorized',
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd ?? 0,
    }));

  return {
    meta: {
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      rows: rows.length,
      watchlist: snapshot.watchlist.length,
      eligible: eligible.length,
      total_implied_usd: rows.reduce((n, r) => n + r.implied_value_usd, 0),
      global_multiple: globalMultiple,
    },
    multiples,
    comparables,
    rows,
  };
}

/** The ranked board rows the gate checks: rank, value, farm steps. */
export function boardRows(radar: Radar): BoardRow[] {
  return radar.rows.map((r, i) => ({
    slug: r.slug,
    name: r.name,
    rank: i + 1,
    implied_value_usd: r.implied_value_usd,
    farm_steps: r.farm_steps,
  }));
}

/** The gate's own shape, checked before anything is written. Returns a reason or null. */
export function boardIssue(rows: BoardRow[], snapshot: Snapshot): string | null {
  if (rows.length < 100 || rows.length > 4000) return `board holds ${rows.length} rows, not 100 to 4000`;
  const seen = new Set<string>();
  const ranks = new Set<number>();
  let previous = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (seen.has(row.slug)) return `slug ${row.slug} appears twice`;
    seen.add(row.slug);
    if (!Number.isInteger(row.rank) || row.rank < 1) return `row ${row.slug} has a bad rank`;
    ranks.add(row.rank);
    if (row.implied_value_usd <= previous) previous = row.implied_value_usd;
    else return `implied value rises at rank ${row.rank}`;
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd < 1) {
      return `row ${row.slug} has a bad implied value`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `row ${row.slug} has ${row.farm_steps.length} farm steps`;
    }
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `row ${row.slug} has a farm step of ${trimmed.length} characters`;
    }
  }
  for (let rank = 1; rank <= rows.length; rank++) {
    if (!ranks.has(rank)) return `rank ${rank} is missing`;
  }
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  for (const row of rows) {
    if (!slugs.has(row.slug)) return `row ${row.slug} is not in the snapshot`;
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  const values = new Set(rows.map((r) => r.implied_value_usd));
  if (rows.length >= 2 && values.size === 1) return 'every implied value is the same';
  return null;
}

/**
 * The dashboard's data as one compact script, written into dashboard/data.js
 * beside the page. Rows are positional arrays to keep the dossier's source
 * text under its 64 KiB cap: [slug, name, category, chains, tvl, change_7d,
 * age_days, implied, multiple, peers, confidence, on_watchlist, step_keys].
 * The page expands step_keys with dashboard/steps.js, the same table as here.
 */
export function dataScript(radar: Radar): string {
  const rows = radar.rows.map((r) => [
    r.slug,
    r.name,
    r.category,
    r.chains.join('|'),
    r.tvl_usd,
    r.change_7d,
    r.age_days,
    r.implied_value_usd,
    Math.round(r.multiple * 100000) / 100000,
    r.peers,
    r.confidence === 'high' ? 2 : r.confidence === 'medium' ? 1 : 0,
    r.on_watchlist ? 1 : 0,
    r.step_keys,
  ]);
  const data = {
    meta: radar.meta,
    mult: radar.multiples,
    comp: radar.comparables.map((c) => [c.slug, c.name, c.category, c.tvl_usd, c.mcap_usd]),
    rows,
  };
  return `window.RADAR=${JSON.stringify(data)};\n`;
}
