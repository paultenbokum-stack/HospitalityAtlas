import { and, eq, isNull } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { invites, memberships, users } from "@/db/schema";

// Google SSO, invite-only. A Google sign-in is accepted when the verified email is the
// ROOT_ADMIN_EMAIL (bootstraps the first superadmin), already has a user row, or has a
// pending invite — accepting an invite creates the membership.
const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL ?? "").trim().toLowerCase();

// Local-only sign-in by email for existing users, so dev and e2e work without Google
// credentials. Never enabled in production.
const devLogin = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "1";

async function acceptInvites(userId: string, email: string) {
  const pending = await db
    .select()
    .from(invites)
    .where(and(eq(invites.email, email), isNull(invites.acceptedAt)));
  for (const inv of pending) {
    await db
      .insert(memberships)
      .values({ workspaceId: inv.workspaceId, userId, role: inv.role })
      .onConflictDoNothing();
    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inv.id));
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    ...(devLogin
      ? [
          Credentials({
            id: "dev",
            credentials: { email: { label: "Email", type: "email" } },
            authorize: async (credentials) => {
              const email = String(credentials?.email ?? "").trim().toLowerCase();
              const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
              return user ? { id: user.id, email: user.email, name: user.name, isSuperadmin: user.isSuperadmin } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      if (!email) return false;
      if ((profile as { email_verified?: boolean } | undefined)?.email_verified === false) return false;

      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const isRoot = ROOT_ADMIN_EMAIL.length > 0 && email === ROOT_ADMIN_EMAIL;
      const [invite] = await db
        .select({ id: invites.id })
        .from(invites)
        .where(and(eq(invites.email, email), isNull(invites.acceptedAt)))
        .limit(1);
      if (!existing && !isRoot && !invite) return "/login?error=not-invited";

      const userId =
        existing?.id ??
        (await db.insert(users).values({ email, name: user?.name ?? null, isSuperadmin: isRoot }).returning())[0].id;
      if (existing && ((!existing.name && user?.name) || (isRoot && !existing.isSuperadmin))) {
        await db
          .update(users)
          .set({ name: existing.name ?? user?.name ?? null, isSuperadmin: existing.isSuperadmin || isRoot })
          .where(eq(users.id, existing.id));
      }
      await acceptInvites(userId, email);
      return true;
    },

    async jwt({ token, user, account }) {
      if (account) {
        const email = (user?.email ?? token.email ?? "").toLowerCase();
        const [dbUser] = await db
          .select({ id: users.id, isSuperadmin: users.isSuperadmin })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (dbUser) {
          token.sub = dbUser.id;
          token.isSuperadmin = dbUser.isSuperadmin;
        }
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.isSuperadmin = Boolean(token.isSuperadmin);
      }
      return session;
    },
  },
});

export const devLoginEnabled = devLogin;
