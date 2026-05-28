// Display helpers — keep the components readable.

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Accept both "2026-05-19" and "2026-05-19 12:34:56.789" styles.
  const date = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function formatAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dob = new Date(iso.includes(" ") ? iso.replace(" ", "T") + "Z" : iso);
  if (Number.isNaN(dob.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years -= 1;
  if (years < 0) return "—";
  if (years < 2) {
    const months =
      (now.getFullYear() - dob.getFullYear()) * 12 +
      (now.getMonth() - dob.getMonth()) -
      (now.getDate() < dob.getDate() ? 1 : 0);
    return `${Math.max(0, months)}mo`;
  }
  return `${years}y`;
}

export function sexLabel(sex: number): string {
  switch (sex) {
    case 1:
      return "M";
    case 2:
      return "F";
    default:
      return "—";
  }
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
