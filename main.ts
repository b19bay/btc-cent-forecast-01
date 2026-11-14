// btc-cent-forecast-01: forecast Bitcoin's price 240 minutes ahead.
//
// Method: a 720-minute exponential moving average over the 72 hours of
// 1-minute closes up to the checkpoint, pulled 5% of the way from the last
// close toward the EMA, with a +/-5% log-space safety clip. The forecast is
// a small mean-reversion step: when the recent trend sits above the last
// close the guess rises slightly, and vice versa. Fully deterministic:
// no clock, no randomness, no network, standard library only.

import * as fs from "node:fs";
import * as path from "node:path";

interface CaseFile {
  case?: unknown;
  markets?: unknown;
}

interface Market {
  prices?: unknown;
}

const FALLBACK_PRICE = 60000;
const EMA_SPAN_MINUTES = 720;
const PULL_TOWARD_EMA = 0.05;
const LOG_CLIP = 0.05;
const MIN_PRICE = 0.00001;
const MAX_PRICE = 9999999.99999;

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

// Forecast from a list of usable (finite) prices. With a single price the
// EMA equals that price, so the forecast is the price itself.
function forecastFromPrices(prices: number[]): number {
  const last = prices[prices.length - 1];
  const k = 2 / (EMA_SPAN_MINUTES + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  let f = last + PULL_TOWARD_EMA * (ema - last);
  if (!Number.isFinite(f) || f <= 0) {
    f = last;
  } else {
    const logRatio = clamp(Math.log(f / last), -LOG_CLIP, LOG_CLIP);
    f = last * Math.exp(logRatio);
  }
  f = Math.round(f * 100000) / 100000;
  return clamp(f, MIN_PRICE, MAX_PRICE);
}

// Keep only finite numbers; a stray non-numeric entry must not poison
// the whole case.
function usablePrices(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const value of raw) {
    if (typeof value === "number" && Number.isFinite(value)) {
      out.push(value);
    }
  }
  return out;
}

function writeOutput(outputDir: string, caseId: string, price: number): void {
  const safePrice = clamp(price, MIN_PRICE, MAX_PRICE);
  const text =
    JSON.stringify({ forecasts: [{ case: caseId, price: safePrice }] }) + "\n";
  fs.writeFileSync(path.join(outputDir, caseId + ".out"), text, "utf8");
}

function main(): void {
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input/";
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/";
  fs.mkdirSync(outputDir, { recursive: true });

  let names: string[];
  try {
    names = fs
      .readdirSync(inputDir)
      .filter((name) => name.endsWith(".in"))
      .sort();
  } catch {
    return;
  }

  for (const name of names) {
    const caseId = name.slice(0, -".in".length);
    try {
      const rawText = fs.readFileSync(path.join(inputDir, name), "utf8");
      const parsed = JSON.parse(rawText) as CaseFile;
      const idFromFile =
        typeof parsed.case === "string" && parsed.case.length > 0
          ? parsed.case
          : caseId;
      const markets = parsed.markets;
      // Exactly one market is the normal shape. If the list is malformed,
      // still salvage every usable price the file holds before falling
      // back to the default price, so a stray extra market can never
      // discard prices that are actually there.
      let prices: number[] = [];
      if (Array.isArray(markets) && markets.length === 1) {
        prices = usablePrices((markets[0] as Market).prices);
      } else if (Array.isArray(markets)) {
        for (const market of markets) {
          prices = prices.concat(usablePrices((market as Market).prices));
        }
      }
      if (prices.length === 0) {
        writeOutput(outputDir, idFromFile, FALLBACK_PRICE);
      } else {
        writeOutput(outputDir, idFromFile, forecastFromPrices(prices));
      }
    } catch {
      // Unparseable case file: never crash, never skip the output.
      writeOutput(outputDir, caseId, FALLBACK_PRICE);
    }
  }
}

main();
