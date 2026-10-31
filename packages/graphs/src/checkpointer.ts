import path from "node:path";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let saverPromise: Promise<PostgresSaver> | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!saverPromise) {
    saverPromise = (async () => {
      if (!process.env.DATABASE_URL) {
        try {
          process.loadEnvFile(path.resolve(__dirname, "../../../.env"));
        } catch {
          // Ignore if root .env is missing
        }
      }

      const connString = process.env.DATABASE_URL;
      if (!connString) {
        throw new Error("DATABASE_URL is required for PostgresSaver checkpointer.");
      }

      const saver = PostgresSaver.fromConnString(connString);
      await saver.setup();
      return saver;
    })();
  }

  return saverPromise;
}
