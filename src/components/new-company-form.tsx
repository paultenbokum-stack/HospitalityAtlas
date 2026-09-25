"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCompanyAction } from "@/lib/actions/companies";

type Dup = { id: string; name: string; locality: string | null };

export function NewCompanyForm({
  stages,
  members,
  me,
}: {
  stages: { id: string; label: string }[];
  members: { id: string; label: string }[];
  me: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dups, setDups] = useState<Dup[] | null>(null);

  function submit(fd: FormData, allowDuplicate: boolean) {
    setError(null);
    start(async () => {
      const r = await createCompanyAction({
        name: fd.get("name"),
        locality: fd.get("locality"),
        region: fd.get("region"),
        address: fd.get("address"),
        phone: fd.get("phone"),
        website: fd.get("website"),
        email: fd.get("email"),
        contactRoles: String(fd.get("contactRoles") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        stageId: fd.get("stageId"),
        ownerUserId: fd.get("ownerUserId") || null,
        allowDuplicate,
      });
      if (!r.ok) return setError(r.error);
      if ("duplicates" in r.data && r.data.duplicates) return setDups(r.data.duplicates);
      if ("id" in r.data) router.push(`/companies/${r.data.id}`);
    });
  }

  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget), dups !== null);
      }}
    >
      <div>
        <label className="label" htmlFor="name">
          Business name *
        </label>
        <input id="name" name="name" className="input" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="locality">
            Town / suburb
          </label>
          <input id="locality" name="locality" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="region">
            Province / region
          </label>
          <input id="region" name="region" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">
          Address
        </label>
        <input id="address" name="address" className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="phone">
            Business phone
          </label>
          <input id="phone" name="phone" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="website">
            Website
          </label>
          <input id="website" name="website" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Generic inbox
          </label>
          <input id="email" name="email" className="input" placeholder="info@…" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="contactRoles">
          Who we deal with (roles, comma-separated)
        </label>
        <input id="contactRoles" name="contactRoles" className="input" placeholder="Owner, General manager" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="stageId">
            Stage
          </label>
          <select id="stageId" name="stageId" className="input">
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ownerUserId">
            Owner
          </label>
          <select id="ownerUserId" name="ownerUserId" className="input" defaultValue={me}>
            <option value="">Unowned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dups && (
        <div className="rounded-md bg-warn-soft p-3 text-sm text-warn-ink">
          Possible duplicate:
          <ul className="mt-1 list-disc pl-5">
            {dups.map((d) => (
              <li key={d.id}>
                <Link href={`/companies/${d.id}`} className="underline">
                  {d.name}
                  {d.locality ? `, ${d.locality}` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1">Save again to add it anyway.</p>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary" disabled={pending}>
        {dups ? "Add anyway" : "Add company"}
      </button>
    </form>
  );
}
