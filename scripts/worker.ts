import "dotenv/config";

import { createBoss } from "@/lib/email/worker";

async function main() {
  const boss = await createBoss();
  console.log("Worker started");

  process.on("SIGINT", async () => {
    await boss.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
