import { env } from "../env";

/**
 * On-demand lyric-line explanations via DeepSeek's chat completions API.
 * A plain function module rather than a swappable-provider interface — this
 * isn't meant to be swapped out like the LyricsProvider abstraction, it's a
 * single external call.
 *
 * Deliberately does not retry (unlike lib/lyrics/lrclib.ts's fetchJson):
 * DeepSeek calls cost money per request, so auto-retrying a paid LLM call to
 * smooth over a transient blip roughly doubles spend for something the user
 * can just tap again. A single attempt with a generous timeout is the better
 * tradeoff here.
 *
 * This is a pass-through interpretation call, not model training or lyric
 * redistribution — only the tapped line plus a line of surrounding context
 * is sent, on demand, never pre-fetched or stored beyond the transient
 * process-local cache (see docs/16-future-features.md, Spotify §III.14).
 */

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const TIMEOUT_MS = 18000;

const SYSTEM_PROMPT = `You are a concise, insightful music-lyrics annotator.
- Explain in 2-4 sentences what this one line likely means: themes, wordplay, references, emotional intent.
- You are given the line plus a little surrounding context only — never assume you know the rest of the song's lyrics beyond what's shown.
- Do not reproduce or quote lyrics back beyond the single line given.
- If genuinely ambiguous, give the most plausible reading and say it's an interpretation, don't invent unverified biographical trivia.
- Plain prose, no markdown headers or bullet lists, no preamble like "This line means".`;

export interface ExplainParams {
  title: string;
  artist: string;
  line: string;
  prevLine?: string;
  nextLine?: string;
}

export async function explainLine(params: ExplainParams): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(params) },
        ],
        temperature: 0.4,
        max_tokens: 220,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`deepseek: HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("deepseek: empty response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function buildUserPrompt(p: ExplainParams): string {
  const context = [
    p.prevLine ? `Previous line: "${p.prevLine}"` : null,
    `Line to explain: "${p.line}"`,
    p.nextLine ? `Next line: "${p.nextLine}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `Song: "${p.title}" by ${p.artist}\n\n${context}\n\nExplain what the "Line to explain" means.`;
}
