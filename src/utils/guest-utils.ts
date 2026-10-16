/** Parses a Supabase timestamp, treating values without a zone suffix as UTC. */
export const parseTs = (s: string) => new Date(s.endsWith("Z") ? s : `${s}Z`);

/** "1j 20m" / "35m" between two dates (never negative). */
export const durationLabel = (from: Date, to: Date) => {
  const mins = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}j ${mins % 60}m` : `${mins}m`;
};

/** Builds a wa.me link from a local phone number, converting a leading 0 to 62. Returns null when no digits remain. */
export const whatsappLink = (phone?: string | null) => {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0/, "62");
  return digits ? `https://wa.me/${digits}` : null;
};

/** "Hari ini", "Kemarin", or a long Indonesian date such as "Senin, 5 Oktober". */
export const dayLabel = (d: Date, now = new Date()) => {
  const diff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
};

/** Groups guests by check-in day (newest first), each group labelled via {@link dayLabel}. */
export const groupByDay = <T extends { check_in: string }>(guests: T[], now = new Date()) => {
  const sorted = [...guests].sort(
    (a, b) => parseTs(b.check_in).getTime() - parseTs(a.check_in).getTime(),
  );
  const groups: { label: string; items: T[] }[] = [];
  for (const g of sorted) {
    const label = dayLabel(parseTs(g.check_in), now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(g);
    else groups.push({ label, items: [g] });
  }
  return groups;
};
