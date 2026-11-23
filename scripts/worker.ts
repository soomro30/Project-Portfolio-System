import "dotenv/config";

import { createBoss } from "@/lib/email/worker";

async function main() {
  const boss = await createBoss();
  console.log("Worker started");

  async function shutdown() {
    await boss.stop({ graceful: true, timeout: 30_000 });
  }

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
