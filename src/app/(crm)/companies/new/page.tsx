import { NewCompanyForm } from "@/components/new-company-form";
import { listMembers, listStages } from "@/lib/repo/config";
import { displayName } from "@/lib/format";
import { requirePageContext } from "@/lib/session";

export default async function NewCompanyPage() {
  const ctx = await requirePageContext();
  const [stages, members] = await Promise.all([listStages(ctx.workspace.id), listMembers(ctx.workspace.id)]);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Add company</h1>
      <p className="text-sm text-muted">
        Business details only — the business line, website and a generic inbox. Record who you deal with by role
        (&ldquo;Owner&rdquo;, &ldquo;GM&rdquo;), not by name.
      </p>
      <NewCompanyForm
        stages={stages.filter((s) => s.kind === "open").map((s) => ({ id: s.id, label: s.label }))}
        members={members.map((m) => ({ id: m.id, label: displayName(m) }))}
        me={ctx.userId}
      />
    </div>
  );
}
