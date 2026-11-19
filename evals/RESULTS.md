# Eval results

Run 2026-11-19T11:48:16.716Z against https://samasalt-mitra-staging.samasalt-mitra-worker.workers.dev. 22/23 cases pass (96%); exact composition key correct in 22/23. Photos 17/18, typed 5/5. Median latency 11686 ms. On photos where both a brand and a composition were read, the composition independently agreed with the brand in 17/17.

All photos are synthetic renders (evals/render_strips.py), not real strips: real-world accuracy will be lower and is measured in the field pilot.

| case | result | got | via | composition agrees | ms |
|---|---|---|---|---|---|
| img-dolo650 | pass | Dolo 650 Tablet | brand+composition | true | 13598 |
| img-pan40 | pass | PAN 40 Tablet | brand+composition | true | 10873 |
| img-augmentin625 | pass | Augmentin 625 Duo Tablet | brand+composition | true | 13889 |
| img-telma40 | pass | Telma 40 Tablet | brand+composition | true | 11016 |
| img-glycomet-sr | pass | Glycomet 500 SR Tablet | brand+composition | true | 13378 |
| img-azithral500 | pass | Azithral 500 Tablet | brand+composition | true | 12014 |
| img-ecosprin75 | pass | Ecosprin 75 Tablet | brand+composition | true | 10168 |
| img-amlokind5 | pass | Amlokind 5 Tablet | brand+composition | true | 14643 |
| img-montair10 | pass | Montair 10 Tablet | brand+composition | true | 14558 |
| img-thyronorm50 | pass | Thyronorm 50mcg Tablet | brand+composition | true | 14162 |
| img-crocin-pr | pass | Crocin Pain Relief Tablet | brand+composition | true | 32049 |
| img-atorva20 | pass | Atorva 20 Tablet | brand+composition | true | 11686 |
| img-ecosprin-av | pass | Ecosprin AV 75/20 Capsule | brand+composition | true | 15486 |
| img-allegra120 | pass | Allegra 120mg Tablet | brand+composition | true | 14636 |
| img-rosuvas10 | pass | Rosuvas 10 Tablet | brand+composition | true | 15411 |
| hard-heavy-blur | **fail** | — | — | true | 10863 |
| hard-cropped | pass | PAN 40 Tablet | brand+composition | true | 11008 |
| hard-unknown-brand | pass | PYRETOL-650 | composition | — | 10312 |
| txt-dolo-glued | pass | Dolo 650 Tablet | brand | — | 534 |
| txt-kannada | pass | Dolo 650 Tablet | brand | — | 914 |
| txt-hindi | pass | PAN 40 Tablet | brand | — | 1534 |
| txt-augmentin | pass | Augmentin 625 Duo Tablet | brand | — | 553 |
| txt-telma-pin | pass | Telma 40 Tablet | brand | — | 982 |
