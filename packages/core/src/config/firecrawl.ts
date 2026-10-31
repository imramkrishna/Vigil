import path from "node:path";
import { Firecrawl } from "firecrawl";

let client: Firecrawl | null = null;

/** Created on first use so importing @vigil/core doesn't fail when the key isn't set. */
function getFirecrawl(): Firecrawl {
  if (client) return client;

  if (!process.env.FIRECRAWL_API_KEY) {
    try {
      process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
    } catch {
      // Ignore if root .env is not present
    }
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not found. Set it in .env.");
  }

  client = new Firecrawl({ apiKey });
  return client;
}

export async function webSearch(topic: string, limit = 3) {
  if (!topic.trim()) {
    throw new Error("webSearch requires a non-empty topic.");
  }

  return getFirecrawl().search(topic.trim(), {
    limit,
    scrapeOptions: { formats: ["markdown"] },
  });
}

export async function webScrape(url: string) {
  assertHttpUrl(url);

  return getFirecrawl().scrape(url, { formats: ["markdown"] });
}

export async function webScrapeAndInteract(url: string, prompt: string) {
  assertHttpUrl(url);
  if (!prompt.trim()) {
    throw new Error("webScrapeAndInteract requires a non-empty prompt.");
  }

  const firecrawl = getFirecrawl();
  const scraped = await firecrawl.scrape(url, { formats: ["markdown"] });

  const scrapeId = scraped.metadata?.scrapeId;
  if (!scrapeId) {
    throw new Error(`Firecrawl returned no scrapeId for ${url}; cannot interact.`);
  }

  return firecrawl.interact(scrapeId, { prompt });
}

function assertHttpUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http(s) URLs are supported: ${url}`);
  }
}
