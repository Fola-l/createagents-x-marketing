// src/replyScoring.ts

/**
 * Very lightweight quality gate to avoid "fluff" replies.
 * Goal: only post replies that signal credibility (infra/operator usefulness).
 *
 * Threshold suggestion:
 *  - >= 2 : post
 *  - < 2  : skip
 */
export function scoreReply(text: string): number {
  let score = 0;
  const t = text.toLowerCase();

  // Authority / infra concepts (builder-respect signals)
  const infraSignals = [
    "routing",
    "handoff",
    "triage",
    "state",
    "memory",
    "context",
    "uptime",
    "retries",
    "rate limit",
    "webhook",
    "infra",
    "deployment",
    "production",
    "orchestration",
    "queue",
    "idempot",
    "observability",
    "monitor",
    "slo",
  ];

  const hasInfraSignal = infraSignals.some((s) => t.includes(s));
  if (hasInfraSignal) score += 2;

  // Questions only valuable when paired with substance — not as engagement bait
  // Removed unconditional +2 for "?" to stop forcing questions on every reply

  // Concise validation / operator framing (without sounding salesy)
  const usefulOperatorPhrases = [
    "at that volume",
    "makes sense",
    "common issue",
    "usually the bottleneck",
    "first thing i'd check",
    "depends on your flow",
    "the unlock",
    "that's the gap",
    "worth trying",
  ];
  const hasOperatorPhrase = usefulOperatorPhrases.some((p) => t.includes(p));
  if (hasOperatorPhrase) score += 2;

  // Questions only get points if reply also has substance (prevents empty engagement bait)
  const hasSubstance = hasInfraSignal || hasOperatorPhrase;
  if (text.includes("?") && hasSubstance) score += 1;

  // Penalties: fluff / low-signal
  const fluff = ["totally", "same", "this!", "so true", "love this", "facts"];
  if (fluff.some((f) => t.includes(f))) score -= 3;

  // Penalties: salesy / spammy
  const salesy = [
    "check us out",
    "our platform",
    "we can help",
    "dm me",
    "sign up",
    "join now",
  ];
  if (salesy.some((s) => t.includes(s))) score -= 4;

  // Penalties: hype/buzzwords
  const buzz = ["revolutionary", "game-changing", "disrupt", "next-gen"];
  if (buzz.some((b) => t.includes(b))) score -= 2;

  return score;
}
