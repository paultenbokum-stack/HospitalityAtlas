import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.local)");

// Cloud SQL on Cloud Run is reached over a unix socket, supplied in the URL as
// `?host=/cloudsql/<project:region:instance>`. postgres.js only uses a unix socket
// when `options.path` points at the socket FILE, and it can't derive that here
// itself (it can't `new URL()` the empty-host form, and the ':' in the connection
// name defeats its auto host→path logic). So extract the socket dir and pass the
// full socket path explicitly. A plain TCP URL (local dev) passes straight through.
function connect() {
  const socketMatch = DATABASE_URL!.match(/[?&]host=([^&]*)/);
  if (!socketMatch) return postgres(DATABASE_URL!, { max: 10 });
  const socketDir = decodeURIComponent(socketMatch[1]);
  const url = DATABASE_URL!.replace(/\?.*$/, "").replace("@/", "@localhost/");
  return postgres(url, { max: 10, path: `${socketDir}/.s.PGSQL.5432` });
}

// Reuse one connection pool across HMR reloads in dev, so we don't exhaust Postgres.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};
const client = globalForDb.pgClient ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
