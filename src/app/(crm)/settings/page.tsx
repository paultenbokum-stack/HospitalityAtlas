import {
  AttributesSettings,
  DiscoverySettings,
  LabelListSettings,
  MembersSettings,
  StagesSettings,
  WorkspaceName,
} from "@/components/settings";
import {
  listActivityTypes,
  listAttributeDefs,
  listMembers,
  listOutcomeReasons,
  listPendingInvites,
  listStages,
} from "@/lib/repo/config";
import { requirePageContext } from "@/lib/session";

export default async function SettingsPage() {
  const ctx = await requirePageContext("admin");
  const ws = ctx.workspace.id;
  const [members, invites, stages, reasons, types, defs] = await Promise.all([
    listMembers(ws),
    listPendingInvites(ws),
    listStages(ws, { includeInactive: true }),
    listOutcomeReasons(ws, { includeInactive: true }),
    listActivityTypes(ws, { includeInactive: true }),
    listAttributeDefs(ws, { includeInactive: true }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <WorkspaceName name={ctx.workspace.name} />
      <MembersSettings
        me={ctx.userId}
        members={members}
        invites={invites.filter((i) => !i.acceptedAt).map((i) => ({ id: i.id, email: i.email, role: i.role }))}
      />
      <StagesSettings stages={stages} />
      <LabelListSettings kind="reasons" title="Outcome reasons" hint="Asked for when a company moves to a lost stage — this is what 'Why we lose' reports on." items={reasons} />
      <LabelListSettings kind="types" title="Activity types" hint="The buttons on the quick-log bar." items={types} />
      <AttributesSettings defs={defs} />
      <DiscoverySettings
        terms={ctx.workspace.settings.discovery?.searchTerms ?? []}
        presets={ctx.workspace.settings.discovery?.presets ?? []}
      />
    </div>
  );
}
