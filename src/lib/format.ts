const DAY = 86_400_000;

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// "Today", "Tomorrow", "3 days overdue", "in 5 days" — for follow-up columns.
export function relativeDue(d: Date | string | null | undefined): { text: string; overdue: boolean } {
  if (!d) return { text: "", overdue: false };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / DAY);
  if (days === 0) return { text: "Today", overdue: false };
  if (days === 1) return { text: "Tomorrow", overdue: false };
  if (days < 0) return { text: `${-days}d overdue`, overdue: true };
  if (days < 14) return { text: `in ${days}d`, overdue: false };
  return { text: formatDate(d), overdue: false };
}

export function relativeAgo(d: Date | string | null | undefined): string {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function displayName(u: { name?: string | null; email?: string | null } | null | undefined): string {
  return u?.name || u?.email?.split("@")[0] || "";
}
