"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleTaskAction } from "@/lib/actions/companies";

export function TaskCheck({ taskId, label }: { taskId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      className="mt-1"
      aria-label={`Mark ${label} done`}
      disabled={pending}
      onChange={() =>
        start(async () => {
          await toggleTaskAction(taskId, true);
          router.refresh();
        })
      }
    />
  );
}
