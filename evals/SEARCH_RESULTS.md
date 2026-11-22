# Search test set results

Run 2026-11-22T19:08:16.618Z against https://samasalt-mitra.samasalt-mitra-worker.workers.dev. **67/67 pass.** Answered right 41, offered among the choices 26, missed 0, **wrong matches 0** (must be 0), errors 0. Median 733 ms.

Cases: evals/search_cases.src.json (expected compositions taken from the data by evals/build_search_cases.mjs).

| case | typed | expect | outcome | got |
|---|---|---|---|---|
| exact-dolo650 | Dolo 650 | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| exact-dolo650-lower | dolo 650 | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| exact-dolo650-glued | dolo650 | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| exact-dolo650-tablet | Dolo 650 tablet | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| exact-pan40 | Pan 40 | answer | right | PAN 40 Tablet [Pantoprazole 40 mg · tablet] |
| exact-telma40 | Telma 40 | answer | right | Telma 40 Tablet [Telmisartan 40 mg · tablet] |
| exact-thyronorm50 | Thyronorm 50 | answer | right | Thyronorm 50mcg Tablet [Thyroxine 50 mcg · tablet] |
| exact-ecosprin75 | Ecosprin 75 | answer | right | Ecosprin 75 Tablet [Aspirin 75 mg · tablet] |
| exact-atorva10 | Atorva 10 | answer | right | Atorva Tablet [Atorvastatin 10 mg · tablet] |
| exact-atorva20 | Atorva 20 | answer | right | Atorva 20 Tablet [Atorvastatin 20 mg · tablet] |
| exact-calpol500 | Calpol 500 | answer | right | Calpol 500mg Tablet [Paracetamol 500 mg · tablet] |
| exact-pcm650 | PCM 650 | answer | right | PCM 650mg Tablet [Paracetamol 650 mg · tablet] |
| exact-hcq200 | HCQ 200 | answer | right | HCQ 200mg Tablet [Hydroxychloroquine 200 mg · tablet] |
| exact-glycomet500sr | Glycomet 500 SR | answer | right | Glycomet 500 SR Tablet [Metformin 500 mg · tablet · SR] |
| exact-crocin-advance | Crocin Advance | answer | right | Crocin Advance Tablet [Paracetamol 500 mg · tablet] |
| exact-pand | Pan-D capsule | choice | offered | choices: Pan-D Capsule PR; Panci D Tablet; Panel D Tablet; Pango D Tablet; Pandot D Tablet |
| exact-amlokind5 | Amlokind 5 | answer | right | Amlokind 5 Tablet [Amlodipine 5 mg · tablet] |
| exact-shelcal | Shelcal 500 | none | right | not_found |
| nostrength-atorva | Atorva | choice | offered | choices: Atorva Tablet; Atorva 5 Tablet; Atorva 20 Tablet; Atorva 40 Tablet; Atorva 80 Tablet |
| nostrength-telma | Telma | choice | offered | choices: Telma 20 Tablet; Telma 40 Tablet; Telma 80 Tablet; Telma H Tablet; Telma-AM Tablet |
| nostrength-dolo | Dolo | choice | offered | choices: Dolo Drops; Dolo 500 Tablet; Dolo 650 Tablet; Dolo 1000mg Tablet; Dolo 120 Suspension |
| nostrength-thyronorm | Thyronorm | choice | offered | choices: Thyronorm 25mcg Tablet; Thyronorm 50mcg Tablet; Thyronorm 75mcg Tablet; Thyronorm 88mcg Tablet; Thyronorm 100mc |
| nostrength-crocin | Crocin | choice | offered | choices: Crocin 1000mg Tablet; Crocin Advance Tablet; Crocin Pain Relief Tablet |
| variant-telmah | Telma H | choice | offered | choices: Telma H Tablet; Telma 80-H Tablet |
| variant-augmentin625 | Augmentin 625 | choice | offered | choices: Augmentin 625 Duo Tablet |
| variant-azithro500 | Azithro 500 | choice | offered | choices: Azithro Max 500mg Tablet; Azithrov 500 Tablet; Azithromat 500 Tablet; Azithron 500mg Tablet; Azithropen 500 Tab |
| variant-atorva-e | Atorva E | choice | offered | choices: Atorva E 40 Tablet; Atorva E 10mg/10mg Tablet; Atorva Tablet |
| variant-calpol-syp | Calpol syp | none | right | choices: Calpol T  Tablet |
| typo-dolo-o-for-zero | Dolo 65O | choice | offered | did you mean: Dolo 650 Tablet; Dolopar 650 Tablet; Dololife 650 Tablet; Dolomed 650mg Tablet; Doloxer 650mg Tablet |
| typo-augmentn | Augmentn 625 | choice | offered | did you mean: Augmentin 625 Duo Tablet |
| typo-dolp | Dolp 500 | choice | offered | choices: Dolpi 100mg/500mg Tablet; Dolpip TZ 4000mg/500mg Injection |
| typo-crocn | Crocn advance | choice | offered | did you mean: Crocin Advance Tablet; Cron-P Tablet; Crocs 100mg Capsule; Crocin 1000mg Tablet; Crocon 200mg Capsule |
| typo-thyronrm | Thyronrm 50 | choice | offered | did you mean: Thyronorm 50mcg Tablet; Thyronex 50 Tablet; Thyronic 50mcg Tablet |
| short-pcm500 | pcm 500 | answer | right | PCM Tablet [Paracetamol 500 mg · tablet] |
| short-pcm250-susp | pcm 250 susp | answer | right | PCM 250mg Oral Suspension [Paracetamol 250mg/5 ml · liquid] |
| ja-name-para650 | Paracetamol Tablets IP 650 mg | answer | right | Paracetamol Tablets IP 650 mg [Paracetamol 650 mg · tablet] |
| ja-short-para650 | Paracetamol 650 | answer | right | Paracetamol Tablets IP 650 mg [Paracetamol 650 mg · tablet] |
| ja-name-panto40 | Pantoprazole Gastro Resistant Tablets IP 40 mg | answer | right | Pantoprazole Gastro Resistant Tablets IP 40 mg [Pantoprazole 40 mg · tablet] |
| ja-short-telmi40 | Telmisartan 40 | answer | right | Telmisartan Tablets IP 40mg [Telmisartan 40 mg · tablet] |
| ja-short-metformin500 | Metformin 500 | answer | right | Metformin Hydrochloride Tablets IP 500mg [Metformin 500 mg · tablet] |
| ja-chlorthalidone | Chlorthalidone 12.5 | answer | right | Chlorthalidone Tablets IP 12.5mg [Chlortalidone 12.5 mg · tablet] |
| ja-torsemide20 | Torsemide 20 | answer | right | Torsemide Tablets IP 20 mg [Torasemide 20 mg · tablet] |
| ja-pand-pr | Pantoprazole 40mg (Gastro-resistant) and Domperidone 30mg (Prolonged Release) Capsules IP | answer | right | Pantoprazole 40mg (Gastro-resistant) and Domperidone 30mg (Prolonged Release) Capsules IP [Domperidone 30 mg + Pantopraz |
| sr-pand | Pan D | choice | offered | choices: Pan-D Capsule PR; Panci D Tablet; Panel D Tablet; Pango D Tablet; Pandot D Tablet |
| sr-pantocid-dsr | Pantocid DSR | answer | right | Pantocid DSR Capsule [Domperidone 30 mg + Pantoprazole 40 mg · capsule · SR] |
| sr-glycomet-gp1 | Glycomet GP 1 | choice | offered | choices: Glycomet-GP 1 Tablet PR; Glycomet-GP 1 Forte Tablet SR; Glycomet-GP 1/850 Tablet SR; Glycomet Trio 1 Tablet SR; |
| liquid-scan-para250 | Each 5 ml contains Paracetamol IP 250 mg Oral Suspension | answer | right | Paracetamol 250mg/5 ml [Paracetamol 250mg/5 ml · liquid] |
| liquid-scan-amoxclav | Each 5 ml of reconstituted suspension contains Amoxycillin IP 400 mg and Clavulanic Acid 57 mg | answer | right | Amoxicillin 400mg/5 ml + Clavulanic Acid 57mg/5 ml [Amoxicillin 400mg/5 ml + Clavulanic Acid 57mg/5 ml · liquid] |
| scan-tablet-amoxclav | Each film coated tablet contains Amoxycillin 500 mg Clavulanic acid 125 mg | answer | right | Amoxicillin 500 mg + Clavulanic Acid 125 mg [Amoxicillin 500 mg + Clavulanic Acid 125 mg · tablet] |
| kn-dolo650 | ಡೋಲೋ 650 | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| hi-dolo650 | डोलो 650 | answer | right | Dolo 650 Tablet [Paracetamol 650 mg · tablet] |
| hi-telma40 | टेल्मा 40 | choice | offered | choices: Telma 40 Tablet; Telma H Tablet; Telma-AM Tablet; Telma-NB Tablet; Telma-LNC Tablet |
| hi-atorva10 | एटोर्वा 10 | choice | offered | choices: Atorva Tablet; Atoriv 10mg Tablet; Etorvas 10mg Tablet; Atorva E 40 Tablet; Atorva E 10mg/10mg Tablet |
| kn-thyronorm50 | ಥೈರೋನಾರ್ಮ್ 50 | choice | offered | choices: Thyronorm 50mcg Tablet |
| hi-pan40 | पैन 40 टैबलेट | choice | right | PAN 40 Tablet [Pantoprazole 40 mg · tablet] |
| hi-metformin500 | मेटफॉर्मिन 500 | choice | offered | choices: Metformin Hydrochloride Tablets IP 500mg; Metformin Hydrochloride Prolonged release Tablets IP 500 mg; Metformi |
| hi-amox500 | अमोक्सीसिलिन 500 | choice | offered | choices: Amoxycillin Capsules IP 500mg; Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP; Amoxycillin 500mg  |
| hi-para650 | पैरासिटामोल 650 | choice | offered | choices: Paracetamol Tablets IP 650 mg; Paracetamol 650mg and Caffeine 50mg Tablets IP |
| kn-amlodipine5 | ಅಮ್ಲೋಡಿಪಿನ್ 5 | choice | offered | choices: Amlodipine Tablets IP 5mg; Amlodipine + Enalapril Tablet (5/5 Mg); Amlodipine + Indapamide Tablet (5/1.5 Mg); A |
| hi-panto40 | पैंटोप्राजोल 40 | choice | offered | choices: Pantoprazole Gastro Resistant Tablets IP 40 mg; Pantoprazole Injection 40mg; Pantoprazole 40mg and Domperidone  |
| kn-cetirizine10 | ಸಿಟಿರಿಜಿನ್ 10 | choice | offered | choices: Cetrizine Hydrochloride Tablets IP 10mg; Cetrizine Tablet; Sitrizin 10mg Tablet; Citrazan 10mg Tablet; Citrimin |
| nti-brivapride25 | Brivapride 25 | answer | right | Brivapride 25mg Tablet [Brivaracetam 25 mg · tablet] |
| nti-thyronorm100 | Thyronorm 100 | answer | right | Thyronorm 100mcg Tablet [Thyroxine 100 mcg · tablet] |
| none-gaviscon | Gaviscon oral syrup | none | right | not_found |
| none-junk | Zzqxw 999 | none | right | not_found |
| none-dolo999 | Dolo 999 | none | right | not_found |
| none-sentence | which tablet is good for fever | none | right | not_found |
