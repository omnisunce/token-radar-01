// Farm-step playbooks for the dashboard. This table is the same table as
// lib/model.ts STEP_TEMPLATES, string for string: the board's steps are
// expanded from it by main.ts, and the page expands the same keys from the
// rows in data.js, so the page and the board can never disagree.
// {n} is the protocol name, {c} its first chain.
window.RADAR_STEPS = {
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

/** Expand one step template for a protocol. Pure function, no DOM. */
window.expandStep = function (key, name, chain) {
  var template = window.RADAR_STEPS[key];
  if (template === undefined) return '';
  return template.split('{n}').join(name).split('{c}').join(chain);
};
