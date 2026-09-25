import Link from "next/link";
import { TaskCheck } from "@/components/task-check";
import { StageBadge } from "@/components/stage-badge";
import { relativeAgo, relativeDue } from "@/lib/format";
import { listMyOpenTasks, listRecentlyTouched } from "@/lib/repo/timeline";
import { requirePageContext } from "@/lib/session";

export default async function TodayPage() {
  const ctx = await requirePageContext();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const [tasks, recent] = await Promise.all([
    listMyOpenTasks(ctx.workspace.id, ctx.userId, endOfToday),
    listRecentlyTouched(ctx.workspace.id, ctx.userId),
  ]);
  recent.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">My day</h1>
        {!tasks.length ? (
          <div className="card p-6 text-sm text-muted">
            Nothing due today.{" "}
            <Link href="/companies?owner=me&follow=none" className="text-accent underline">
              See your companies without a next step
            </Link>
            .
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {tasks.map((t) => {
              const due = relativeDue(t.dueAt);
              return (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <TaskCheck taskId={t.id} label={t.title} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.title}</div>
                    <Link href={`/companies/${t.companyId}`} className="text-muted hover:underline">
                      {t.companyName}
                      {t.companyLocality ? `, ${t.companyLocality}` : ""}
                    </Link>
                  </div>
                  <div className="text-right">
                    <StageBadge label={t.stageLabel} color={t.stageColor} />
                    <div className={`mt-1 text-xs ${due.overdue ? "font-medium text-danger" : "text-muted"}`}>{due.text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Recently worked on</h2>
        <ul className="card divide-y divide-border text-sm">
          {recent.length === 0 && <li className="px-4 py-3 text-muted">No activity logged yet.</li>}
          {recent.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 px-4 py-2">
              <Link href={`/companies/${c.id}`} className="truncate hover:underline">
                {c.name}
              </Link>
              <span className="shrink-0 text-xs text-muted">{relativeAgo(c.at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
