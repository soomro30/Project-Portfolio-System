import "dotenv/config";

import { ensureAdminUser } from "@/lib/domain/projects";

async function main() {
  const admin = await ensureAdminUser();
  console.log(`Admin user ready: ${admin.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
