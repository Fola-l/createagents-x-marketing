import { runPipelineWithSummary } from "./pipeline";
import { QUERY_PHRASES, INTERVAL_MINUTES } from "./config";

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/**
 * Adds ±30% jitter around INTERVAL_MINUTES to avoid predictable timing.
 * Example: 120 mins -> waits between ~84 and ~156 mins.
 */
function nextWaitMs(baseMinutes: number) {
  const variance = baseMinutes * 0.3;
  const min = Math.max(1, baseMinutes - variance);
  const max = baseMinutes + variance;
  const minutes = Math.random() * (max - min) + min;
  return Math.floor(minutes * 60 * 1000);
}

async function main() {
  console.log("🚀 Runner started (CLI interval mode).");

  if (!QUERY_PHRASES.length) {
    console.error("❌ No QUERY_PHRASES set. Add QUERY_PHRASES in your .env.");
    process.exit(1);
  }

  if (!INTERVAL_MINUTES || Number.isNaN(INTERVAL_MINUTES)) {
    console.error("❌ INTERVAL_MINUTES is missing/invalid.");
    process.exit(1);
  }

  while (true) {
    console.log("🔄 Starting pipeline cycle...");

    for (const phrase of QUERY_PHRASES) {
      try {
        console.log(`➡️ Running phrase: "${phrase}"`);
        await runPipelineWithSummary(phrase);
      } catch (err) {
        console.error(`❌ Pipeline error for phrase "${phrase}":`, err);
      }
    }

    const waitMs = nextWaitMs(INTERVAL_MINUTES);
    console.log(`⏳ Waiting ${(waitMs / 60000).toFixed(1)} minutes before next cycle...`);
    await sleep(waitMs);
  }
}

main().catch(err => {
  console.error("❌ Runner crashed:", err);
  process.exit(1);
});
