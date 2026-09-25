import { signOut } from "@/auth";

export default function NoAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-sm p-6 text-sm">
        <h1 className="text-lg font-semibold">No workspace yet</h1>
        <p className="mt-2 text-muted">
          You&apos;re signed in, but you aren&apos;t a member of any workspace. Ask an admin to invite you.
        </p>
        <form
          className="mt-4"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="btn">Sign out</button>
        </form>
      </div>
    </main>
  );
}
