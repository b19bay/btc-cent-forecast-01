# btc-cent-forecast-01

Forecasts Bitcoin's US-dollar price 240 minutes after each checkpoint, from
the 4,320 one-minute closes of the 72 hours up to that checkpoint.

## Run

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads every `*.in` case file in the input directory (or `/input/` when
`MAKEFUN_INPUT_DIR` is unset) and writes one `/output/<id>.out` per case
(or to `MAKEFUN_OUTPUT_DIR` when set), each holding
`{"forecasts":[{"case":"<id>","price":<number>}]}`.

## Method

The forecast is a 720-minute exponential moving average over the whole
72-hour window, seeded at the first close, pulled 5% of the way from the
last close toward that average, with a +/-5% clip in log space as a guard
against pathological windows, then rounded to 5 decimals. It is a small
mean-reversion step: when the recent trend sits above the last close the
guess rises slightly, and vice versa. The program is fully deterministic —
no clock, no randomness, no network — and never crashes on a malformed
case: it always writes a valid output, falling back to the last usable
price, or 60000.00 when no price is available.
