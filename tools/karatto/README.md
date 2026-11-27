# カラット fixtures

Headless checks for the planet's simulation and the politics (no browser, no deck). Run from the repository root:

```
node tools/karatto/gov.test.mjs    # the politics brief's acceptance scenarios (votes, pledges, escrow, lots, absence, migration)
node tools/karatto/repro.mjs       # the economy cases from the audit: 14 days at founding / N5 / N3, strikes, a 28-day gap
node tools/karatto/balance.mjs     # 14 days, 90 days and 52 weeks × founding / N5 / N3 / N2 × active / twice-weekly / absent
```

Every save is synthetic. Nothing here reads Anki or a gist.
