# KIT / GIST — failure-informed compound triage

Most virtual screens ask "does it bind?" This one first asks **"what killed the last nine drugs against this target?"** — then screens against that.

**Open [`build/report.html`](build/report.html) to see the output.**

## How it works

1. **Build the target report.** Pull every KIT program in GIST from Paperclip (trials, papers, FDA records) and Keenable (current pipeline news). Record what stopped each one — nilotinib on efficacy, ponatinib on cardiovascular toxicity, vatalanib never advanced past phase II.
2. **Turn failures into a rubric.** 20 scoring criteria, each tied to a cited source. Criteria that no tool can measure are shown as gaps rather than silently dropped.
3. **Screen.** Ptarmigan ranked 10,000 compounds against KIT (P10721) by predicted engagement — no protein structure required. Tamarind predicted ADMET for all 10,000.
4. **Score against the rubric.** Engagement first, property flags second.

## Does it work?

Avapritinib — an approved KIT inhibitor — was scored blind alongside the library and came out **3rd of 10,000** on engagement and **3rd overall**. Ripretinib and regorafenib also rank in the top few percent. Imatinib and sunitinib are absent from the screening library, and the report says so rather than hiding it.

## Known limits

- Ptarmigan accepts catalog proteins only, so the exon 13/14/17 resistance mutants could not be screened. KIT (976 aa) also exceeds the model's recorded training length.
- ADMET values are predictions, not measurements. They flag liabilities; they are not PK.
- Published PK/PD rows are populated for ripretinib only.
- Nothing here is validated at the bench. Every number traces to a cited source or a named model.

## Run it

```
python -m kittriage build --out build --compounds evidence/scored_compounds_input.json
python -m unittest discover -s tests
```

`--as-of YYYY-MM-DD` restricts evidence to publications before a date, so the rubric can be rebuilt as it would have looked at any point in the past.
