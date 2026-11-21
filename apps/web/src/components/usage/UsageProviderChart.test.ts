import { describe, expect, it } from "vite-plus/test";

import { buildPeriodColumns, providerSeries } from "./UsageProviderChart";
import { PROVIDER_ORDER } from "./usageProviders";

describe("buildPeriodColumns", () => {
  const days = ["2026-08-01", "2026-08-02", "2026-08-03"];
  const byDay = new Map([
    [
      "2026-08-01",
      {
        day: "2026-08-01",
        costUsd: 42,
        totalTokens: 420,
        byProvider: new Map([
          ["codex" as const, { costUsd: 10, totalTokens: 100 }],
          ["claude" as const, { costUsd: 20, totalTokens: 200 }],
          ["pi" as const, { costUsd: 5, totalTokens: 50 }],
          ["muse" as const, { costUsd: 7, totalTokens: 70 }],
        ]),
        byAccount: new Map(),
      },
    ],
    [
      "2026-08-03",
      {
        day: "2026-08-03",
        costUsd: 5,
        totalTokens: 50,
        byProvider: new Map([["claude" as const, { costUsd: 5, totalTokens: 50 }]]),
        byAccount: new Map(),
      },
    ],
  ]);

  it("keeps band values absolute rather than cumulative", () => {
    const [first] = buildPeriodColumns(days, byDay, providerSeries(PROVIDER_ORDER), "cost");

    expect(first?.bands).toEqual([
      { key: "codex", value: 10 },
      { key: "claude", value: 20 },
      { key: "grok", value: 0 },
      { key: "cursor", value: 0 },
      { key: "opencode", value: 0 },
      { key: "antigravity", value: 0 },
      { key: "pi", value: 5 },
      { key: "muse", value: 7 },
    ]);
  });
});
