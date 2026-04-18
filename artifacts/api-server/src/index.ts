import app from "./app";
import { logger } from "./lib/logger";
import { db, tribeUsersTable } from "@workspace/db";
import { count } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedFirstUser() {
  try {
    const [{ value }] = await db.select({ value: count() }).from(tribeUsersTable);
    if (value === 0) {
      await db.insert(tribeUsersTable).values({
        name: "מנהל",
        role: "marcaz_boger",
        battalion: null,
        active: true,
      });
      logger.info("Seeded default admin user: מנהל (marcaz_boger)");
    }
  } catch (e) {
    logger.warn({ err: e }, "Could not seed first user");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  await seedFirstUser();
});
