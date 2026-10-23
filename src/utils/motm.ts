export type PrizeKind = "cash" | "bill_disc";
export type Prize = { prize: PrizeKind; amount: number };

const KIND_LABEL: Record<PrizeKind, string> = {
  cash: "CASH",
  bill_disc: "BILL DISC",
};

/** The rare jackpot (about 3% on the server). */
export const RARE_PRIZE: Prize = { prize: "bill_disc", amount: 75000 };

/** All prizes, as shown on the gacha reel: six regular ones plus the rare one. */
export const PRIZES: Prize[] = [
  ...(["cash", "bill_disc"] as const).flatMap((prize) =>
    [50000, 30000, 25000].map((amount) => ({ prize, amount })),
  ),
  RARE_PRIZE,
];

/**
 * Gacha tier from how far the winner's score is above the month's average,
 * the same rule `redeem_motm` uses: 50 to 100 above is "boosted" (more 50k
 * and 75k), over 100 above is "jackpot" (no 25k/30k at all). Awards without
 * a stored average are "normal".
 */
export type PrizeTier = "normal" | "boosted" | "jackpot";
export const prizeTier = (score: number, average: number | null): PrizeTier => {
  const gap = score - (average ?? score);
  return gap > 100 ? "jackpot" : gap >= 50 ? "boosted" : "normal";
};

/** Prizes that can come out of a tier (the reel only shows these). */
export const prizesFor = (tier: PrizeTier): Prize[] =>
  tier === "jackpot" ? PRIZES.filter((p) => p.amount >= 50000) : PRIZES;

/** Told to the winner before they spin, or null for the normal tier. */
export const TIER_HINT: Record<PrizeTier, string | null> = {
  normal: null,
  boosted: "Skormu jauh di atas rata-rata, peluang 50k dan 75k naik!",
  jackpot: "Skormu lebih dari 100 di atas rata-rata, hadiahnya pasti 50k ke atas!",
};

/** Whether a prize is the rare jackpot. */
export const isRare = (p: Prize) =>
  p.prize === RARE_PRIZE.prize && p.amount === RARE_PRIZE.amount;

/** "CASH 50k" */
export const prizeLabel = ({ prize, amount }: Prize) =>
  `${KIND_LABEL[prize]} ${amount / 1000}k`;

/** What happens next for a prize, told to the winner. */
export const prizeHint = ({ prize }: Prize) =>
  prize === "bill_disc"
    ? "Langsung dipotong dari tagihan kamu berikutnya."
    : "Hadiahnya akan dikirim ke kamu, ditunggu ya.";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-10" -> "Oktober 2026" */
export const periodLabel = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

/** The "YYYY-MM" period `offset` months from `now` (0 = this month, -1 = last). */
export const periodOf = (offset = 0, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Random prizes above the won one, so the row above it isn't empty when it lands. */
export const REEL_ABOVE = 2;

/**
 * The gacha reel, top to bottom: `REEL_ABOVE` random prizes, the won prize,
 * then `fillers` random prizes, all drawn from `pool`. The reel starts showing
 * the last filler and slides down until the won prize sits in the middle row.
 * `random` is injectable for tests.
 */
export const buildReel = (
  won: Prize,
  fillers = 30,
  random = Math.random,
  pool: Prize[] = PRIZES,
): Prize[] => {
  const pick = () => pool[Math.floor(random() * pool.length)];
  return [
    ...Array.from({ length: REEL_ABOVE }, pick),
    won,
    ...Array.from({ length: fillers }, pick),
  ];
};

/** Average of the members' scores (0 when there are none). */
export const averageScore = (scores: number[]) =>
  scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

/** "+20 di atas rata-rata", "-8,5 di bawah rata-rata" or "Pas rata-rata". */
export const vsAverageLabel = (score: number, average: number) => {
  const gap = Math.round((score - average) * 10) / 10;
  const n = Math.abs(gap).toLocaleString("id-ID");
  return gap > 0 ? `+${n} di atas rata-rata` : gap < 0 ? `-${n} di bawah rata-rata` : "Pas rata-rata";
};
