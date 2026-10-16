export const DEFAULT_YEARLY_RENT = 25_000_000;
/** The yearly contract runs July to June (0-based month index). */
export const CONTRACT_START_MONTH = 6;

export type NewMemberShare = {
  /** Each person's share of the year before the new member (rent / members). */
  yearlyBefore: number;
  /** Each person's share of the year once the new member joins (rent / (members + 1)). */
  yearlyAfter: number;
  /** What the new member pays for the months they stay. */
  newMemberPays: number;
  /** What each current member gets back from that payment. */
  eachCurrentReceives: number;
};

/**
 * Splits the yearly rent when a new member joins mid-contract.
 * Example: 25jt, 5 members, 8 months left -> each paid 5jt for the year,
 * now 4.166.667; the new member pays 25jt / 6 x 8/12 = 2.777.778 and each
 * original member gets back 2.777.778 / 5 = 555.556.
 *
 * new member pays = yearlyRent / (currentMembers + 1) x monthsStaying / 12
 * each current member receives = new member's payment / currentMembers
 *
 * Amounts are rounded to whole rupiah. Invalid inputs (negative, NaN) give 0s.
 *
 * @param yearlyRent - Total rent for 12 months, in rupiah.
 * @param currentMembers - Paying members before the new one joins.
 * @param monthsStaying - Months the new member stays.
 */
export function calcNewMemberShare(
  yearlyRent: number,
  currentMembers: number,
  monthsStaying: number,
): NewMemberShare {
  const valid =
    yearlyRent > 0 && currentMembers >= 0 && monthsStaying > 0;
  if (!valid) {
    return { yearlyBefore: 0, yearlyAfter: 0, newMemberPays: 0, eachCurrentReceives: 0 };
  }

  const yearlyAfter = yearlyRent / (currentMembers + 1);
  const newMemberPays = Math.round((yearlyAfter * monthsStaying) / 12);
  return {
    yearlyBefore: currentMembers > 0 ? Math.round(yearlyRent / currentMembers) : 0,
    yearlyAfter: Math.round(yearlyAfter),
    newMemberPays,
    eachCurrentReceives:
      currentMembers > 0 ? Math.round(newMemberPays / currentMembers) : 0,
  };
}

/**
 * Months left in the yearly contract, treating the current month as already
 * used. With a July start: October -> 8 (Jul-Oct used), July -> 11, June -> 0.
 */
export const monthsLeftInContract = (
  date = new Date(),
  startMonth = CONTRACT_START_MONTH,
): number => 12 - (((date.getMonth() - startMonth + 12) % 12) + 1);

/** Parses a typed amount like "25.000.000" or "25000000" into a number (0 if empty). */
export const parseAmount = (text: string): number =>
  Number(text.replace(/[^\d]/g, "")) || 0;
