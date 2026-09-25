import { redirect } from "next/navigation";
import { auth, devLoginEnabled, signIn } from "@/auth";

const ERRORS: Record<string, string> = {
  "not-invited": "That Google account hasn't been invited. Ask a workspace admin to invite you.",
  AccessDenied: "That Google account hasn't been invited. Ask a workspace admin to invite you.",
  CredentialsSignin: "No user with that email.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/today");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Atlas CRM</h1>
        <p className="mt-1 text-sm text-muted">Sign in with your work Google account.</p>
        {error && (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {ERRORS[error] ?? "Sign-in failed. Please try again."}
          </p>
        )}
        <form
          className="mt-5"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/today" });
          }}
        >
          <button className="btn w-full py-2">
            <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        </form>

        {devLoginEnabled && (
          <form
            className="mt-6 border-t border-border pt-4"
            action={async (fd: FormData) => {
              "use server";
              await signIn("dev", { email: String(fd.get("email") ?? ""), redirectTo: "/today" });
            }}
          >
            <label className="label" htmlFor="email">
              Dev sign-in (local only)
            </label>
            <div className="flex gap-2">
              <input id="email" name="email" className="input" defaultValue="admin@dev.local" />
              <button className="btn">Go</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
