# Search test set results

Run 2026-11-24T09:19:20.039Z against https://samasalt-mitra-staging.samasalt-mitra-worker.workers.dev. **347/363 pass.** Answered right 249, offered among the choices 106, missed 8, **wrong matches 0** (must be 0), errors 0. Median 769 ms.

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
| brand-amaryl1 | Amaryl 1 | answer | right | Amaryl 1mg Tablet [Glimepiride 1 mg · tablet] |
| brand-volibo03 | Volibo 0.3 | answer | right | Volibo 0.3 Tablet [Voglibose 0.3 mg · tablet] |
| brand-stamlo5 | Stamlo 5 | answer | right | Stamlo 5 Tablet [Amlodipine 5 mg · tablet] |
| brand-cilacar10 | Cilacar 10 | answer | right | Cilacar 10 Tablet [Cilnidipine 10 mg · tablet] |
| brand-losar50 | Losar 50 | answer | right | Losar 50 Tablet [Losartan 50 mg · tablet] |
| brand-repace50 | Repace 50 | answer | right | Repace 50 Tablet [Losartan 50 mg · tablet] |
| brand-olmezest20 | Olmezest 20 | answer | right | Olmezest 20 Tablet [Olmesartan Medoxomil 20 mg · tablet] |
| brand-concor5 | Concor 5 | answer | right | Concor 5 Tablet [Bisoprolol 5 mg · tablet] |
| brand-metolar25 | Metolar 25 | answer | right | Metolar 25 Tablet [Metoprolol Tartrate 25 mg · tablet] |
| brand-nebicard5 | Nebicard 5 | answer | **offered** | choices: Nebicard 5 Tablet; Nebicard-V Tablet |
| brand-storvas10 | Storvas 10 | answer | right | Storvas 10 Tablet [Atorvastatin 10 mg · tablet] |
| brand-rosuvas10 | Rosuvas 10 | choice | right | Rosuvas 10 Tablet [Rosuvastatin 10 mg · tablet] |
| brand-pantop40 | Pantop 40 | choice | offered | choices: Pantop 40 Tablet; Pantop Injection |
| brand-razo20 | Razo 20 | answer | right | Razo 20 Tablet [Rabeprazole 20 mg · tablet] |
| brand-omez20 | Omez 20 | answer | right | Omez 20mg Capsule [Omeprazole 20 mg · capsule] |
| brand-nexpro40 | Nexpro 40 | answer | right | Nexpro 40 Tablet [Esomeprazole 40 mg · tablet] |
| brand-rantac150 | Rantac 150 | answer | right | Rantac 150 Tablet [Ranitidine 150 mg · tablet] |
| brand-aciloc150 | Aciloc 150 | answer | right | Aciloc 150 Tablet [Ranitidine 150 mg · tablet] |
| brand-ondem4 | Ondem 4 | answer | right | Ondem 4 Tablet [Ondansetron 4 mg · tablet] |
| brand-emeset4 | Emeset 4 | choice | offered | choices: Emeset 4 Tablet; Emeset Injection 4ml; Emeset Injection 2ml |
| brand-domstal10 | Domstal 10 | answer | right | Domstal 10mg Tablet [Domperidone 10 mg · tablet] |
| brand-sompraz40 | Sompraz 40 | choice | offered | choices: Sompraz 40 Tablet; Sompraz 40mg Injection |
| brand-allegra120 | Allegra 120 | answer | right | Allegra 120mg Tablet [Fexofenadine 120 mg · tablet] |
| brand-allegra180 | Allegra 180 | answer | right | Allegra 180mg Tablet [Fexofenadine 180 mg · tablet] |
| brand-montek-lc | Montek LC | choice | right | Montek LC Tablet [Levocetirizine 5 mg + Montelukast 10 mg · tablet] |
| brand-azee500 | Azee 500 | answer | right | Azee 500 Tablet [Azithromycin 500 mg · tablet] |
| brand-azithral500 | Azithral 500 | choice | offered | choices: Azithral 500 Tablet; Azithral 500mg Injection; Azithral 5D Tablet |
| brand-zifi200 | Zifi 200 | answer | right | Zifi 200 Tablet [Cefixime 200 mg · tablet] |
| brand-cifran500 | Cifran 500 | answer | right | Cifran 500 Tablet [Ciprofloxacin 500 mg · tablet] |
| brand-ciplox500 | Ciplox 500 | answer | right | Ciplox 500 Tablet [Ciprofloxacin 500 mg · tablet] |
| brand-norflox400 | Norflox 400 | answer | right | Norflox 400 Tablet [Lactobacillus 120Million spores + Norfloxacin 400 mg · tablet] |
| brand-oflox200 | Oflox 200 | choice | offered | choices: Oflox 200 Tablet; Oflox 200mg Infusion |
| brand-levoflox500 | Levoflox 500 | choice | offered | choices: Levoflox 500 Tablet; Levoflox 500 Infusion |
| brand-mox500 | Mox 500 | answer | right | Mox 500mg Capsule [Amoxicillin 500 mg · capsule] |
| brand-novamox500 | Novamox 500 | choice | offered | choices: Novamox 500 Capsule; Novamox 500mg Injection |
| brand-clavam625 | Clavam 625 | answer | right | Clavam 625 Tablet [Amoxicillin 500 mg + Clavulanic Acid 125 mg · tablet] |
| brand-metrogyl400 | Metrogyl 400 | answer | right | Metrogyl 400 Tablet [Metronidazole 400 mg · tablet] |
| brand-flagyl400 | Flagyl 400 | answer | right | Flagyl 400 Tablet [Metronidazole 400 mg · tablet] |
| brand-forcan150 | Forcan 150 | answer | right | Forcan 150 Tablet [Fluconazole 150 mg · tablet] |
| brand-zocon150 | Zocon 150 | answer | right | Zocon 150 Tablet [Fluconazole 150 mg · tablet] |
| brand-brufen400 | Brufen 400 | answer | right | Brufen 400 Tablet [Ibuprofen 400 mg · tablet] |
| brand-zerodol-pt | Zerodol PT | answer | right | Zerodol PT Tablet [Aceclofenac 100 mg + Paracetamol 325 mg · tablet] |
| brand-calpol650 | Calpol 650 | answer | right | Calpol 650mg Tablet [Paracetamol 650 mg · tablet] |
| brand-pacimol650 | Pacimol 650 | answer | right | Pacimol 650 Tablet [Paracetamol 650 mg · tablet] |
| brand-folvite5 | Folvite 5 | answer | right | Folvite 5mg Tablet [Folic Acid 5 mg · tablet] |
| brand-pregaba75 | Pregaba 75 | answer | right | Pregaba 75 Capsule [Pregabalin 75 mg · capsule] |
| brand-gabapin300 | Gabapin 300 | answer | right | Gabapin 300 Capsule [Gabapentin 300 mg · capsule] |
| brand-lyrica75 | Lyrica 75 | answer | right | Lyrica 75mg Capsule [Pregabalin 75 mg · capsule] |
| brand-tryptomer10 | Tryptomer 10 | answer | **offered** | choices: Tryptomer 10mg Tablet; Tryptomer G 300mg/10mg Tablet; Tryptomer G 100 mg/10 mg Tablet |
| brand-nexito10 | Nexito 10 | answer | right | Nexito 10 Tablet [Escitalopram Oxalate 10 mg · tablet] |
| brand-alprax025 | Alprax 0.25 | answer | right | Alprax 0.25 Tablet [Alprazolam 0.25 mg · tablet] |
| brand-restyl025 | Restyl 0.25 | answer | right | Restyl 0.25mg Tablet [Alprazolam 0.25 mg · tablet] |
| brand-etizola05 | Etizola 0.5 | answer | right | Etizola 0.5 Tablet [Etizolam 0.5 mg · tablet] |
| brand-zolfresh10 | Zolfresh 10 | answer | right | Zolfresh 10mg Tablet [Zolpidem 10 mg · tablet] |
| brand-oleanz5 | Oleanz 5 | answer | right | Oleanz 5 Tablet [Olanzapine 5 mg · tablet] |
| brand-qutipin25 | Qutipin 25 | answer | right | Qutipin 25 Tablet [Quetiapine 25 mg · tablet] |
| brand-ecosprin150 | Ecosprin 150 | answer | right | Ecosprin 150 Tablet [Aspirin 150 mg · tablet] |
| brand-janumet50-500 | Janumet 50/500 | answer | right | Janumet 50mg/500mg Tablet [Metformin 500 mg + Sitagliptin 50 mg · tablet] |
| brand-galvusmet50-500 | Galvus Met 50/500 | answer | right | Galvus Met 50mg/500mg Tablet [Metformin 500 mg + Vildagliptin 50 mg · tablet] |
| brand-istamet50-1000 | Istamet 50/1000 | answer | right | Istamet 50mg/1000mg Tablet [Metformin 1000 mg + Sitagliptin 50 mg · tablet] |
| brand-ecosprin-av75-20 | Ecosprin AV 75/20 | answer | right | Ecosprin AV 75/20 Capsule [Aspirin 75 mg + Atorvastatin 20 mg · capsule] |
| brand-ecosprin-av75 | Ecosprin AV 75 | choice | offered | choices: Ecosprin-AV 75 Capsule; Ecosprin AV 75/20 Capsule; Ecosprin AV 75/40 Capsule |
| way-stamlo5-glued | stamlo5 | answer | right | Stamlo 5 Tablet [Amlodipine 5 mg · tablet] |
| way-ciplox500-glued | Ciplox500 | answer | right | Ciplox 500 Tablet [Ciprofloxacin 500 mg · tablet] |
| way-nexito10-glued | nexito10 | answer | right | Nexito 10 Tablet [Escitalopram Oxalate 10 mg · tablet] |
| way-allegra120-glued | ALLEGRA120 | answer | right | Allegra 120mg Tablet [Fexofenadine 120 mg · tablet] |
| way-pan40-glued | PAN40 | answer | right | PAN 40 Tablet [Pantoprazole 40 mg · tablet] |
| way-pan40-mg | pan 40mg | answer | right | PAN 40 Tablet [Pantoprazole 40 mg · tablet] |
| way-telma40-mg-tablet | Telma 40mg tablet | answer | right | Telma 40 Tablet [Telmisartan 40 mg · tablet] |
| way-telma40-upper | TELMA 40 | answer | right | Telma 40 Tablet [Telmisartan 40 mg · tablet] |
| way-azee500-mg | Azee 500mg | answer | right | Azee 500 Tablet [Azithromycin 500 mg · tablet] |
| way-ondem4-mg | Ondem 4mg | answer | right | Ondem 4 Tablet [Ondansetron 4 mg · tablet] |
| way-clavam625-tab | Clavam 625 tab | answer | right | Clavam 625 Tablet [Amoxicillin 500 mg + Clavulanic Acid 125 mg · tablet] |
| way-calpol650-tablet | calpol 650 tablet | answer | right | Calpol 650mg Tablet [Paracetamol 650 mg · tablet] |
| way-mox500-cap | Mox 500 cap | answer | right | Mox 500mg Capsule [Amoxicillin 500 mg · capsule] |
| way-omez20-capsule | Omez 20 capsule | answer | right | Omez 20mg Capsule [Omeprazole 20 mg · capsule] |
| way-azithral500-tablet | Azithral 500 tablet | answer | right | Azithral 500 Tablet [Azithromycin 500 mg · tablet] |
| way-oflox200-tab | Oflox 200 tab | answer | **offered** | choices: Oflox 200 Tablet; Oflox 200mg Infusion |
| typo-amaril1 | Amaril 1 | choice | offered | did you mean: Amaryl 1mg Tablet; Amarin M1 Tablet ER; Amarin PM1 Tablet ER; Amaryl M  1mg Tablet PR; Amaryl MP 1mg Table |
| typo-rosuvaz10 | Rosuvaz 10 | choice | right | Rosuvaz 10mg Tablet [Rosuvastatin 10 mg · tablet] |
| typo-pantp40 | Pantp 40 | choice | offered | choices: Pantpro 40mg Tablet |
| typo-azitral500 | Azitral 500 | choice | offered | did you mean: Azital 500mg Tablet; Azithral 500 Tablet; Azitrac 500mg Tablet; Azitras 500mg Tablet; Azital-LB 500 Tablet |
| typo-metrogil400 | Metrogil 400 | choice | offered | did you mean: Metrogyl 400 Tablet; Metrodil M 400mg/500mg Tablet; Metrogyl Compound 400mg/500mg Tablet; Metrozol 400mg T |
| typo-telmaa40 | Telmaa 40 | choice | offered | did you mean: Telma 40 Tablet; Telmac 40mg Tablet; Telman 40mg Tablet; Telmas 40mg Tablet; Telmat 40mg Tablet |
| typo-pregabba75 | Pregabba 75 | choice | offered | did you mean: Pregaba 75 Capsule; Pregaba SR 75 Tablet; Pregaba-M 75 Capsule; Pregaba-M SR 75 Tablet; Pregaba NT 75 mg/1 |
| typo-lyrika75 | Lyrika 75 | choice | offered | did you mean: Lyrica 75mg Capsule |
| typo-ecospirin75 | Ecospirin 75 | choice | offered | did you mean: Ecosprin 75 Tablet; Ecosprin-AV 75 Capsule; Ecosprin AV 75/20 Capsule; Ecosprin AV 75/40 Capsule |
| typo-augmentine625 | Augmentine 625 | choice | offered | did you mean: Augmentin 625 Duo Tablet |
| typo-allegr120 | Alegra 120 | choice | **missed** | did you mean: Alero 120mg Tablet; Alert 120mg Tablet; Aler-FM 10mg/120mg Tablet; Alegrid M 10mg/120mg Tablet |
| typo-nexitto10 | Nexitto 10 | choice | offered | did you mean: Nexito 10 Tablet |
| typo-cilacr10 | Cilacr 10 | choice | offered | did you mean: Cilacar 10 Tablet; Cilacar-M 10/25 Tablet ER; Cilacar-M 10/50 Tablet ER; Cilacar TM 10mg/25mg/40mg Tablet; |
| typo-zolfrsh10 | Zolfrsh 10 | choice | offered | did you mean: Zolfresh 10mg Tablet; Zolfirst 0.5mg/10mg Tablet |
| typo-glycomett500sr | Glycomett 500 SR | choice | offered | did you mean: Glycomet 500 SR Tablet; Glycimet -SR 500 Tablet |
| nostrength-losar | Losar | choice | offered | choices: Losar 25 Tablet; Losar 50 Tablet; Losar 100mg Tablet; Losar-A Tablet; Losar-H Tablet |
| nostrength-pantop | Pantop | choice | offered | choices: Pantop Injection; Pantop 20 Tablet; Pantop 40 Tablet |
| nostrength-azee | Azee | choice | offered | choices: Azee 250 Tablet; Azee 500 Tablet; Azee 1000 Tablet; Azee 200 DT Tablet; Azee 200mg Dry Syrup |
| nostrength-allegra | Allegra | choice | offered | choices: Allegra Nasal Spray; Allegra 120mg Tablet; Allegra 180mg Tablet |
| nostrength-ondem | Ondem | choice | offered | choices: Ondem Syrup; Ondem Injection; Ondem 4 Tablet; Ondem 8 Tablet; Ondem 8mg Injection |
| nostrength-ecosprin | Ecosprin | choice | offered | choices: Ecosprin 75 Tablet; Ecosprin 150 Tablet; Ecosprin 325 Tablet; Ecosprin-AV 75 Capsule; Ecosprin-AV 150 Capsule |
| nostrength-amaryl | Amaryl | choice | offered | choices: Amaryl 1mg Tablet; Amaryl 2mg Tablet; Amaryl 3mg Tablet; Amaryl 4mg Tablet; Amaryl M  1mg Tablet PR |
| nostrength-concor | Concor | choice | offered | choices: Concor 5 Tablet; Concor 10 Tablet; Concor Plus Tablet; Concor AM 5 Tablet; Concor AM 2.5 Tablet |
| nostrength-galvusmet | Galvus Met | choice | offered | choices: Galvus Met 50mg/500mg Tablet; Galvus Met 50mg/850mg Tablet; Galvus Met 50mg/1000mg Tablet |
| nostrength-combiflam | Combiflam | choice | offered | choices: Combiflam Tablet; Combiflam Suspension |
| nostrength-ultracet | Ultracet | choice | offered | choices: Ultracet Tablet; Ultracet 500mg/50mg Tablet |
| nostrength-methycobal | Methycobal | choice | offered | choices: Methycobal Tablet; Methycobal Injection |
| liquid-ascoril-ls | Ascoril LS syrup | choice | right | Ascoril LS Syrup [Ambroxol 30mg/5 ml + Levosalbutamol 1mg/5 ml · liquid] |
| liquid-benadryl | Benadryl syrup | choice | right | Benadryl Syrup [Ammonium Chloride 138mg/5 ml + Diphenhydramine 14.08mg/5 ml · liquid] |
| liquid-alex | Alex syrup | choice | right | Alex Syrup [Chlorpheniramine Maleate 2mg/5 ml + Phenylephrine 5mg/5 ml · liquid] |
| liquid-calpol250-susp | Calpol 250 suspension | choice | offered | choices: Calpol 250mg Paediatric Oral Suspension Strawberry; Calpol 250mg Tablet |
| liquid-zifi100-dry | Zifi 100 dry syrup | answer | right | Zifi 100 Dry Syrup [Cefixime 100mg/5 ml · liquid] |
| liquid-combiflam-susp | Combiflam suspension | answer | right | Combiflam Suspension [Ibuprofen 100 mg + Paracetamol 162.5 mg · liquid] |
| liquid-ibugesic-plus-susp | Ibugesic Plus suspension | answer | **offered** | choices: Ibugesic Plus Oral Suspension Orange; Ibugesic Plus Tablet; Ibugesic Oral Suspension Orange |
| liquid-augmentin-duo | Augmentin Duo syrup | choice | right | Augmentin Duo Oral Suspension [Amoxicillin 200 mg + Clavulanic Acid 28.5 mg · liquid] |
| liquid-zentel-susp | Zentel suspension | choice | right | Zentel Oral Suspension [Albendazole 400 mg · liquid] |
| liquid-montair-lc-kid | Montair LC Kid syrup | answer | right | Montair LC Kid Syrup [Levocetirizine 2.5mg/5 ml + Montelukast 4mg/5 ml · liquid] |
| liquid-montek-lc-kid | Montek LC Kid syrup | answer | right | Montek LC Kid Syrup [Levocetirizine 2.5mg/5 ml + Montelukast 4mg/5 ml · liquid] |
| liquid-grilinctus-ls | Grilinctus LS syrup | choice | right | Grilinctus-LS Syrup [Ambroxol 30mg/5 ml + Levosalbutamol 1mg/5 ml · liquid] |
| liquid-cyclopam-susp | Cyclopam suspension | answer | right | Cyclopam Suspension [Dicyclomine 10 mg + Simethicone 40 mg · liquid] |
| liquid-zifi100-tablet | Zifi 100 tablet | answer | **offered** | choices: Zifi 100 DT Tablet; Zifi-LBX 100 Tablet; Zifi-O 100 DT Tablet; Zifi CV 100 DT Tablet; Zifi 100 Dry Syrup |
| liquid-ja-ondansetron | Ondansetron Oral Solution IP 2 mg per 5ml | answer | right | Ondansetron Oral Solution IP 2 mg per 5ml [Ondansetron 2mg/5 ml · liquid] |
| liquid-ja-azithro | Azithromycin Oral Suspension IP 100mg per 5ml | answer | right | Azithromycin Oral Suspension IP 100mg per 5ml [Azithromycin 100mg/5 ml · liquid] |
| liquid-ja-albendazole | Albendazole Oral Suspension IP 200 mg per 5ml | answer | right | Albendazole Oral Suspension IP 200 mg per 5ml [Albendazole 200mg/5 ml · liquid] |
| liquid-ja-ranitidine | Ranitidine Syrup IP 75 mg per 5ml | answer | right | Ranitidine Syrup IP 75 mg per 5ml [Ranitidine 75mg/5 ml · liquid] |
| liquid-ja-cefixime | Cefixime Oral Suspension IP 50mg per 5ml | answer | right | Cefixime Oral Suspension IP 50mg per 5ml [Cefixime 50mg/5 ml · liquid] |
| liquid-ja-montelukast-levocet | Montelukast 4mg and Levocetirizine 2.5mg Syrup | answer | right | Montelukast 4mg and Levocetirizine 2.5mg Syrup [Levocetirizine 2.5 mg + Montelukast 4 mg · liquid] |
| liquid-short-ranitidine | Ranitidine syrup | choice | **missed** | not_found |
| release-glycomet1g-sr | Glycomet 1g SR | answer | **missed** | choices: Glycomet Trio 1 Tablet SR; Glycomet-GP 1 Forte Tablet SR; Glycomet Trio Forte 1 Tablet SR; Glycomet-GP 1/850 Ta |
| release-glyciphage-sr500 | Glyciphage SR 500 | answer | right | Glyciphage SR 500mg Tablet [Metformin 500 mg · tablet · SR] |
| release-gluconorm-sr500 | Gluconorm SR 500 | answer | **offered** | choices: Gluconorm SR 500mg Tablet; Gluconorm-V 0.2 Tablet SR; Gluconorm-V 0.3 Tablet SR |
| release-diamicron-xr60 | Diamicron XR 60 | answer | right | Diamicron XR 60 Tablet [Gliclazide 60 mg · tablet · XR] |
| release-metxl25 | Met XL 25 | answer | **offered** | choices: Met XL 25 Tablet; Met XL 3D 25/12.5 |
| release-metxl50 | Met XL 50 | answer | **offered** | choices: Met XL 50 Tablet; Met XL 3D 50 Tablet; Met XL 3D 50/6.25 Tablet |
| release-prolomet-xl50 | Prolomet XL 50 | answer | right | Prolomet XL 50 Tablet [Metoprolol Succinate 47.5 mg · tablet · XL] |
| release-seloken-xl50 | Seloken XL 50 | answer | right | Seloken XL 50mg Tablet [Metoprolol Succinate 47.5 mg · tablet · XL] |
| release-nitrocontin26 | Nitrocontin 2.6 | choice | offered | choices: Nitrocontin 2.6 Tablet CR |
| release-ganaton-od | Ganaton OD | choice | offered | choices: Ganaton OD Capsule SR; Ganaton Tablet; Ganaton Total Capsule SR |
| release-alfoo10 | Alfoo 10 | choice | offered | choices: Alfoo 10mg Tablet PR |
| release-urimax04 | Urimax 0.4 | choice | offered | choices: Urimax 0.4 Capsule MR; Urimax 0.4 Ecopack Capsule MR |
| release-veltam04 | Veltam 0.4 | choice | offered | choices: Veltam 0.4 Tablet MR |
| release-voveran-sr100 | Voveran SR 100 | answer | right | Voveran SR 100 Tablet [Diclofenac 100 mg · tablet · SR] |
| release-ja-diclofenac-pr | Diclofenac Sodium Prolonged Release Tablets IP 100 mg | answer | right | Diclofenac Sodium Prolonged Release Tablets IP 100 mg [Diclofenac 100 mg · tablet · SR] |
| release-ja-gliclazide-xr | Gliclazide Extended release Tablets 60 mg | answer | right | Gliclazide Extended release Tablets 60 mg [Gliclazide 60 mg · tablet · XR] |
| release-ja-tamsulosin-pr | Tamsulosin Hydrochloride Prolonged Release Capsules IP 0.4mg | answer | right | Tamsulosin Hydrochloride Prolonged Release Capsules IP 0.4mg [Tamsulosin 0.4 mg · capsule · SR] |
| release-ja-aceclofenac-sr | Aceclofenac Sustained Release Tablets 200mg | answer | right | Aceclofenac Sustained Release Tablets 200mg [Aceclofenac 200 mg · tablet · SR] |
| release-ja-metoprolol-er | Metoprolol Extended release Tablets IP 50mg | answer | right | Metoprolol Extended release Tablets IP 50mg [Metoprolol 50 mg · tablet · XR] |
| release-salt-gliclazide60xr | Gliclazide 60 XR | choice | offered | choices: Gliclazide Extended release Tablets 60 mg |
| release-salt-diclofenac100sr | Diclofenac 100 SR | choice | offered | choices: Diclofenac Sodium Prolonged Release Tablets IP 100 mg; Diclofam 100mg Capsule SR |
| release-salt-metoprolol50xr | Metoprolol 50 XR | choice | offered | choices: Metoprolol Extended release Tablets IP 50mg; Metoprolol Succinate extended release capsules IP 50mg; Hi Blonet  |
| release-salt-tamsulosin04 | Tamsulosin 0.4 | choice | offered | choices: Jotam 0.4mg Tablet; Urinat 0.4mg Capsule; Tamsulosin Hydrochloride Prolonged Release Capsules IP 0.4mg; Uriwell |
| release-plain-gliclazide80 | Gliclazide 80 | choice | right | Gliclazide Tablets IP 80 mg [Gliclazide 80 mg · tablet] |
| release-plain-diclofenac50 | Diclofenac 50 | choice | right | Diclofenac Gastro-Resistant Tablets IP 50 mg [Diclofenac 50 mg · tablet] |
| ja-name-atorva10 | Atorvastatin Tablets IP 10mg | answer | right | Atorvastatin Tablets IP 10mg [Atorvastatin 10 mg · tablet] |
| ja-name-losartan50 | Losartan Tablets IP 50mg | answer | right | Losartan Tablets IP 50mg [Losartan 50 mg · tablet] |
| ja-name-glimepiride1 | Glimepiride Tablets IP 1mg | answer | right | Glimepiride Tablets IP 1mg [Glimepiride 1 mg · tablet] |
| ja-name-rosuva10 | Rosuvastatin Tablets IP 10mg | answer | right | Rosuvastatin Tablets IP 10mg [Rosuvastatin 10 mg · tablet] |
| ja-name-clopidogrel75 | Clopidogrel Tablets IP 75mg | answer | right | Clopidogrel Tablets IP 75mg [Clopidogrel 75 mg · tablet] |
| ja-name-clopi-asp | Clopidogrel 75mg and Aspirin 75mg Tablets IP | answer | right | Clopidogrel 75mg and Aspirin 75mg Tablets IP [Aspirin 75 mg + Clopidogrel 75 mg · tablet] |
| ja-name-ondansetron4 | Ondansetron Tablets IP 4 mg | answer | right | Ondansetron Tablets IP 4 mg [Ondansetron 4 mg · tablet] |
| ja-name-rabeprazole20 | Rabeprazole Gastro Resistant Tablets IP 20 mg | answer | right | Rabeprazole Gastro Resistant Tablets IP 20 mg [Rabeprazole 20 mg · tablet] |
| ja-name-ofloxacin200 | Ofloxacin Tablets IP 200mg | answer | right | Ofloxacin Tablets IP 200mg [Ofloxacin 200 mg · tablet] |
| ja-name-cefixime200 | Cefixime Tablets IP 200 mg | answer | right | Cefixime Tablets IP 200 mg [Cefixime 200 mg · tablet] |
| ja-name-amoxclav625 | Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP | answer | right | Amoxycillin 500mg and Potassium Clavulanate 125mg Tablets IP [Amoxicillin 500 mg + Clavulanic Acid 125 mg · tablet] |
| ja-name-ibuprofen400 | Ibuprofen Tablets IP 400 mg | answer | right | Ibuprofen Tablets IP 400 mg [Ibuprofen 400 mg · tablet] |
| ja-name-ibu-para | Ibuprofen 400mg and Paracetamol 325mg Tablets IP | answer | right | Ibuprofen 400mg and Paracetamol 325mg Tablets IP [Ibuprofen 400 mg + Paracetamol 325 mg · tablet] |
| ja-name-aceclo-para | Aceclofenac 100mg and Paracetamol 325mg Tablets | answer | right | Aceclofenac 100mg and Paracetamol 325mg Tablets [Aceclofenac 100 mg + Paracetamol 325 mg · tablet] |
| ja-name-azithro500 | Azithromycin Tablets IP 500 mg | answer | right | Azithromycin Tablets IP 500 mg [Azithromycin 500 mg · tablet] |
| ja-name-monte-levocet | Montelukast Sodium 10mg and Levocetirizine 5mg Tablets IP | answer | right | Montelukast Sodium 10mg and Levocetirizine 5mg Tablets IP [Levocetirizine 5 mg + Montelukast 10 mg · tablet] |
| ja-name-vildagliptin50 | Vildagliptin Tablets IP 50mg | answer | right | Vildagliptin Tablets IP 50mg [Vildagliptin 50 mg · tablet] |
| ja-name-vilda-met | Vildagliptin 50mg and Metformin Hydrochloride 500mg Tablets IP | answer | right | Vildagliptin 50mg and Metformin Hydrochloride 500mg Tablets IP [Metformin 500 mg + Vildagliptin 50 mg · tablet] |
| ja-name-sitagliptin50 | Sitagliptin Phosphate Tablets IP 50mg | answer | right | Sitagliptin Phosphate Tablets IP 50mg [Sitagliptin 50 mg · tablet] |
| ja-name-bisoprolol5 | Bisoprolol Tablets 5 mg | answer | right | Bisoprolol Tablets 5 mg [Bisoprolol 5 mg · tablet] |
| ja-name-cilnidipine10 | Cilnidipine Tablets IP 10 mg | answer | right | Cilnidipine Tablets IP 10 mg [Cilnidipine 10 mg · tablet] |
| ja-name-olmesartan20 | Olmesartan Medoxomil Tablets IP 20mg | answer | right | Olmesartan Medoxomil Tablets IP 20mg [Olmesartan Medoxomil 20 mg · tablet] |
| ja-name-fexofenadine120 | Fexofenadine Hydrochloride Tablets IP 120mg | answer | right | Fexofenadine Hydrochloride Tablets IP 120mg [Fexofenadine 120 mg · tablet] |
| ja-name-esomeprazole40 | Esomeprazole Tablets IP 40 mg | answer | right | Esomeprazole Tablets IP 40 mg [Esomeprazole 40 mg · tablet] |
| ja-name-escitalopram10 | Escitalopram Tablets IP 10 mg | answer | right | Escitalopram Tablets IP 10 mg [Escitalopram 10 mg · tablet] |
| ja-name-alprazolam025 | Alprazolam Tablets IP 0.25 mg | answer | right | Alprazolam Tablets IP 0.25 mg [Alprazolam 0.25 mg · tablet] |
| ja-name-folic5 | Folic Acid Tablets IP 5 mg | answer | right | Folic Acid Tablets IP 5 mg [Folic Acid 5 mg · tablet] |
| ja-name-metronidazole400 | Metronidazole Tablets IP 400mg | answer | right | Metronidazole Tablets IP 400mg [Metronidazole 400 mg · tablet] |
| ja-name-fluconazole150 | Fluconazole Tablets IP 150 mg | answer | right | Fluconazole Tablets IP 150 mg [Fluconazole 150 mg · tablet] |
| ja-name-albendazole400 | Albendazole Tablets IP 400mg | answer | right | Albendazole 400mg Tablet [Albendazole 400 mg · tablet] |
| ja-name-gabapentin300 | Gabapentin Capsules IP 300mg | answer | right | Gabapentin Capsules IP 300mg [Gabapentin 300 mg · capsule] |
| ja-name-ranitidine150 | Ranitidine Tablets IP 150 mg | answer | right | Ranitidine Tablets IP 150 mg [Ranitidine 150 mg · tablet] |
| ja-name-famotidine20 | Famotidine Tablets IP 20 mg | answer | right | Famotidine Tablets IP 20 mg [Famotidine 20 mg · tablet] |
| ja-name-pregabalin75 | Pregabalin Capsules IP 75 mg | answer | right | Pregabalin Capsules IP 75 mg [Pregabalin 75 mg · capsule] |
| ja-name-methylcobalamin500 | Methylcobalamin Tablet 500mcg | answer | right | Methylcobalamin Tablet 500mcg [Methylcobalamin 0.5 mg · tablet] |
| ja-name-pramipexole | Pramipexole Dihydrochloride Tablets 0.25mg | answer | right | Pramipexole Dihydrochloride Tablets 0.25mg [Pramipexole Dihydrochloride 0.25 mg · tablet] |
| salt-atorva10 | Atorvastatin 10 | choice | right | Atorvastatin Tablets IP 10mg [Atorvastatin 10 mg · tablet] |
| salt-atorva20-mg | Atorvastatin 20 mg | choice | right | Atorvastatin Tablets IP 20mg [Atorvastatin 20 mg · tablet] |
| salt-losartan50 | Losartan 50 | choice | right | Losartan Tablets IP 50mg [Losartan 50 mg · tablet] |
| salt-losartan25-mg | Losartan 25mg | choice | right | Losartan Tablets IP 25mg [Losartan 25 mg · tablet] |
| salt-glimepiride2 | Glimepiride 2 | choice | right | Glimepiride Tablets IP 2mg [Glimepiride 2 mg · tablet] |
| salt-rosuva20 | Rosuvastatin 20 | choice | right | Rosuvastatin Tablets IP 20 mg [Rosuvastatin 20 mg · tablet] |
| salt-clopidogrel75 | Clopidogrel 75 | choice | right | Clopidogrel Tablets IP 75mg [Clopidogrel 75 mg · tablet] |
| salt-ondansetron4 | Ondansetron 4 | choice | right | Ondansetron Tablets IP 4 mg [Ondansetron 4 mg · tablet] |
| salt-rabeprazole20 | Rabeprazole 20 | choice | right | Rabeprazole Gastro Resistant Tablets IP 20 mg [Rabeprazole 20 mg · tablet] |
| salt-ofloxacin200 | Ofloxacin 200 | choice | right | Ofloxacin Tablets IP 200mg [Ofloxacin 200 mg · tablet] |
| salt-cefixime200 | Cefixime 200 | choice | right | Cefixime Tablets IP 200 mg [Cefixime 200 mg · tablet] |
| salt-ibuprofen400 | Ibuprofen 400 | choice | right | Ibuprofen Tablets IP 400 mg [Ibuprofen 400 mg · tablet] |
| salt-azithro500 | Azithromycin 500 | choice | right | Azithromycin Tablets IP 500 mg [Azithromycin 500 mg · tablet] |
| salt-montelukast10 | Montelukast 10 | choice | right | Montelukast Sodium Tablets IP 10mg [Montelukast 10 mg · tablet] |
| salt-vildagliptin50 | Vildagliptin 50 | choice | right | Vildagliptin Tablets IP 50mg [Vildagliptin 50 mg · tablet] |
| salt-sitagliptin100 | Sitagliptin 100 | choice | right | Sitagliptin Phosphate Tablets IP 100mg [Sitagliptin 100 mg · tablet] |
| salt-bisoprolol5 | Bisoprolol 5 | choice | right | Bisoprolol Tablets 5 mg [Bisoprolol 5 mg · tablet] |
| salt-cilnidipine10 | Cilnidipine 10 | choice | right | Cilnidipine Tablets IP 10 mg [Cilnidipine 10 mg · tablet] |
| salt-olmesartan20 | Olmesartan 20 | choice | offered | choices: Olmesartan Medoxomil Tablets IP 20mg |
| salt-fexofenadine180 | Fexofenadine 180 | choice | right | Fexofenadine Tablets IP 180 mg [Fexofenadine 180 mg · tablet] |
| salt-esomeprazole40 | Esomeprazole 40 | choice | right | Esomeprazole Tablets IP 40 mg [Esomeprazole 40 mg · tablet] |
| salt-escitalopram10 | Escitalopram 10 | choice | right | Escitalopram Tablets IP 10 mg [Escitalopram 10 mg · tablet] |
| salt-alprazolam05 | Alprazolam 0.5 | choice | right | Alprazolam Tablets IP 0.5 mg [Alprazolam 0.5 mg · tablet] |
| salt-folic5 | Folic acid 5 | choice | right | Folic Acid Tablets IP 5 mg [Folic Acid 5 mg · tablet] |
| salt-metronidazole400 | Metronidazole 400 | choice | right | Metronidazole Tablets IP 400mg [Metronidazole 400 mg · tablet] |
| salt-fluconazole150 | Fluconazole 150 | choice | right | Fluconazole Tablets IP 150 mg [Fluconazole 150 mg · tablet] |
| salt-gabapentin300 | Gabapentin 300 | choice | right | Gabapentin Capsules IP 300mg [Gabapentin 300 mg · capsule] |
| salt-famotidine40 | Famotidine 40 | choice | right | Famotidine Tablets IP 40 mg [Famotidine 40 mg · tablet] |
| salt-pregabalin75 | Pregabalin 75 | choice | offered | choices: Pregabalin Tablets 75 mg; Pregabalin Capsules IP 75 mg; DavaIndia 75mg Tablet SR; Maigesic 75mg Tablet ER; Gabr |
| salt-itopride50 | Itopride 50 | choice | right | Itopride Tablets IP 50 mg [Itopride 50 mg · tablet] |
| salt-methylcobalamin1500 | Methylcobalamin 1500 mcg | choice | right | Methylcobalamin Tablet 1500mcg [Methylcobalamin 1.5 mg · tablet] |
| salt-pramipexole025 | Pramipexole 0.25 mg | choice | offered | choices: Pramipexole Dihydrochloride Tablets 0.25mg; Parpex 0.25mg Tablet |
| salt-metoprolol50 | Metoprolol 50 mg | choice | offered | choices: Metolash 50 Tablet; Mepol 50mg Tablet; Metoprolol Extended release Tablets IP 50mg; Metoprolol Succinate extend |
| salt-amoxclav | Amoxicillin 500 Clavulanic acid 125 | choice | **missed** | not_found |
| hi-crocin-advance | क्रोसिन एडवांस | choice | offered | choices: Crocin Advance Tablet |
| hi-glycomet500sr | ग्लाइकोमेट 500 एसआर | choice | **missed** | not_found |
| hi-amlokind5 | एमलोकाइंड 5 | choice | **missed** | not_found |
| hi-ecosprin75 | इकोस्प्रिन 75 | choice | offered | choices: Ecosprin 75 Tablet; Ecosprin-AV 75 Capsule; Ecosprin AV 75/20 Capsule; Ecosprin AV 75/40 Capsule; Ecosprin Gold |
| hi-azee500 | एज़ी 500 | choice | offered | choices: Ezee Pain Plus Tablet; Ozi 500 Tablet; Azee 500 Tablet; Azi 500mg Tablet; Azy 500mg Tablet |
| hi-allegra120 | एलेग्रा 120 | choice | offered | choices: Eligra 120mg Tablet |
| hi-augmentin625 | ऑगमेंटिन 625 | choice | **missed** | not_found |
| hi-thyronorm25 | थायरोनॉर्म 25 | choice | offered | choices: Thyronorm 25mcg Tablet |
| hi-ondem4 | ओंडेम 4 | choice | right | Ondem 4 Tablet [Ondansetron 4 mg · tablet] |
| hi-atorvastatin10 | एटोरवास्टेटिन 10 | choice | offered | choices: Atorvastatin Tablets IP 10mg; Atorvastatin 10mg + Ezetimibe 10mg Tablets; Atorvastatin 10mg and Aspirin 150mg C |
| hi-losartan50 | लोसार्टन 50 | choice | offered | choices: Losartan Tablets IP 50mg; Losartan 50mg and Amlodipine 5mg Tablets IP; Losartan + S- Amlodipine Tablet (50/2.5  |
| hi-glimepiride1 | ग्लिमेपिराइड 1 | choice | offered | choices: Glimepiride Tablets IP 1mg; Glimepye M 1mg/500mg Tablet ER |
| hi-telmisartan40 | टेल्मिसार्टन 40 | choice | offered | choices: Telmisartan Tablets IP 40mg; Telmisartan + Indapamide Tablet (40/1.5 Mg); Telmisartan 40mg and Metoprolol 25mg  |
| hi-cetirizine10 | सेटिरिज़िन 10 | choice | offered | choices: Cetrizine Hydrochloride Tablets IP 10mg; Cetrizine Tablet; Cetiriz 10mg Tablet; Sitrizin 10mg Tablet; Cetrilin  |
| kn-crocin-advance | ಕ್ರೋಸಿನ್ ಅಡ್ವಾನ್ಸ್ | choice | offered | choices: Crocin Advance Tablet |
| kn-telma40 | ಟೆಲ್ಮಾ 40 | choice | offered | choices: Telma 40 Tablet; Telma H Tablet; Telma-AM Tablet; Telma-NB Tablet; Telma-LNC Tablet |
| kn-pan40 | ಪ್ಯಾನ್ 40 | choice | offered | choices: PAN 40 Tablet; Pan Up 40mg Tablet; PAN IV Injection; Pan Tart 40mg Injection; Pan-D Capsule PR |
| kn-atorva10 | ಅಟೊರ್ವಾ 10 | choice | offered | choices: Atorva Tablet; Atorva E 40 Tablet; Atorva E 10mg/10mg Tablet; Atorva Asp 75 Capsule; Atorva Asp 150 Capsule |
| kn-glycomet500sr | ಗ್ಲೈಕೋಮೆಟ್ 500 ಎಸ್ಆರ್ | choice | right | Glycomet 500 SR Tablet [Metformin 500 mg · tablet · SR] |
| kn-amlokind5 | ಆಮ್ಲೋಕೈಂಡ್ 5 | choice | **missed** | not_found |
| kn-ecosprin75 | ಇಕೋಸ್ಪ್ರಿನ್ 75 | choice | offered | choices: Ecosprin 75 Tablet; Ecosprin-AV 75 Capsule; Ecosprin AV 75/20 Capsule; Ecosprin AV 75/40 Capsule; Ecosprin Gold |
| kn-allegra120 | ಅಲೆಗ್ರಾ 120 | choice | offered | choices: Eligra 120mg Tablet |
| kn-para650 | ಪ್ಯಾರಸಿಟಮಾಲ್ 650 | choice | offered | choices: Paracetamol Tablets IP 650 mg; Paracetamol 650mg and Caffeine 50mg Tablets IP |
| kn-metformin500 | ಮೆಟ್‌ಫಾರ್ಮಿನ್ 500 | choice | offered | choices: MET 500 Tablet; Met 500mg Tablet; MET-SR 500 Tablet; Met DM 500mg Tablet XL; Metcef 500 Tablet |
| kn-telmisartan40 | ಟೆಲ್ಮಿಸಾರ್ಟನ್ 40 | choice | offered | choices: Telmisartan Tablets IP 40mg; Telmisartan + Indapamide Tablet (40/1.5 Mg); Telmisartan 40mg and Metoprolol 25mg  |
| kn-azithro500 | ಅಜಿಥ್ರೋಮೈಸಿನ್ 500 | choice | offered | choices: Azithromycin Tablets IP 500 mg |
| kn-panto40 | ಪ್ಯಾಂಟೊಪ್ರಜೋಲ್ 40 | choice | offered | choices: Pantoprazole Gastro Resistant Tablets IP 40 mg; Pantoprazole Injection 40mg; Pantoprazole 40mg and Domperidone  |
| nti-warf5 | Warf 5 | answer | right | Warf 5 Tablet [Warfarin 5 mg · tablet] |
| nti-acitrom2 | Acitrom 2 | answer | right | Acitrom 2 Tablet [Acenocoumarol 2 mg · tablet] |
| nti-levipil500 | Levipil 500 | answer | right | Levipil 500 Tablet [Levetiracetam 500 mg · tablet] |
| nti-oxetol300 | Oxetol 300 | choice | offered | choices: Oxetol 300 Tablet; Oxetol Suspension |
| nti-clonotril05 | Clonotril 0.5 | answer | right | Clonotril 0.5 Tablet [Clonazepam 0.5 mg · tablet] |
| nti-lonazep05 | Lonazep 0.5 | answer | right | Lonazep 0.5mg Tablet [Clonazepam 0.5 mg · tablet] |
| nti-frisium10 | Frisium 10 | answer | right | Frisium 10mg Tablet [Clobazam 10 mg · tablet] |
| nti-topamac25 | Topamac 25 | answer | right | Topamac 25mg Tablet [Topiramate 25 mg · tablet] |
| nti-pangraf1 | Pangraf 1 | answer | right | Pangraf 1 Capsule [Tacrolimus 1 mg · capsule] |
| nti-lithosun300 | Lithosun 300 | answer | right | Lithosun 300 Tablet [Lithium Carbonate 300 mg · tablet] |
| nti-lithosun-sr | Lithosun SR | answer | right | Lithosun SR Tablet [Lithium Carbonate 400 mg · tablet · SR] |
| nti-eltroxin50 | Eltroxin 50 | answer | right | Eltroxin 50mcg Tablet [Thyroxine 50 mcg · tablet] |
| nti-thyronorm25 | Thyronorm 25 | answer | right | Thyronorm 25mcg Tablet [Thyroxine 25 mcg · tablet] |
| nti-thyronorm75 | Thyronorm 75 | answer | right | Thyronorm 75mcg Tablet [Thyroxine 75 mcg · tablet] |
| nti-thyronorm88 | Thyronorm 88 | answer | right | Thyronorm 88mcg Tablet [Thyroxine 88 mcg · tablet] |
| nti-thyrox50 | Thyrox 50 | answer | right | Thyrox 50 Tablet [Thyroxine 50 mcg · tablet] |
| nti-encorate-chrono500 | Encorate Chrono 500 | choice | offered | choices: Encorate Chrono 500 Tablet CR; Encorate 500 Tablet |
| nti-lametec50-od | Lametec 50 OD | choice | offered | choices: Lametec 50 OD Tablet SR; Lametec 50 DT Tablet |
| nti-lametec50 | Lametec 50 | choice | offered | choices: Lametec 50 DT Tablet; Lametec 50 OD Tablet SR |
| nti-ja-thyroxine50 | Thyroxine Sodium Tablets IP 50mcg | answer | right | Thyroxine Sodium Tablets IP 50mcg [Thyroxine 50 mcg · tablet] |
| nti-ja-levetiracetam500 | Levetiracetam Tablets IP 500 mg | answer | right | Levetiracetam Tablets IP 500 mg [Levetiracetam 500 mg · tablet] |
| nti-ja-warfarin5 | Warfarin Tablets IP 5 mg | answer | right | Warfarin Tablets IP 5 mg [Warfarin 5 mg · tablet] |
| nti-thyronorm50-glued | thyronorm50 | answer | right | Thyronorm 50mcg Tablet [Thyroxine 50 mcg · tablet] |
| none-telma60 | Telma 60 | none | right | not_found |
| none-pan60 | Pan 60 | none | right | not_found |
| none-azee750 | Azee 750 | none | right | not_found |
| none-allegra240 | Allegra 240 | none | right | not_found |
| none-stamlo7 | Stamlo 7 | none | right | not_found |
| none-thyronorm60 | Thyronorm 60 | none | right | not_found |
| none-warf7 | Warf 7 | none | right | not_found |
| none-levipil600 | Levipil 600 | none | right | not_found |
| nti-warf4 | Warf 4 | answer | right | Warf 4mg Tablet [Warfarin 4 mg · tablet] |
| none-augmentin1500 | Augmentin 1500 | none | right | not_found |
| none-telma40-syrup | Telma 40 syrup | none | right | choices: Telma 40 Tablet; Telma-LN 40 Tablet; Telma-AM H 40 Tablet; Telmac 40mg Tablet; Telman 40mg Tablet |
| none-pan40-syrup | Pan 40 syrup | none | right | choices: PAN 40 Tablet; Pan Up 40mg Tablet; Pan Tart 40mg Injection; Panav 40 Tablet; Panbi 40 Tablet |
| none-dolo650-injection | Dolo 650 injection | none | right | choices: Dolo 650 Tablet; Dolopar 650 Tablet; Dololife 650 Tablet; Dolomed 650mg Tablet; Doloxer 650mg Tablet |
| none-allegra120-syrup | Allegra 120 syrup | none | right | choices: Allegra 120mg Tablet; Allegratune 120 Tablet |
| none-atorvastatin15 | Atorvastatin 15 | none | right | not_found |
| none-metformin300 | Metformin 300 | none | right | not_found |
| none-tablet | tablet | none | right | not_found |
| none-asdf | asdf | none | right | not_found |
| none-digits | 12345 | none | right | not_found |
| none-bp-medicine | medicine for BP | none | right | did you mean: Medicaine Oral Gel; Medidin Gel; Meditone Syrup; Medicip-O Tablet; Medisone 4mg Tablet |
| none-sugar-tablet | sugar tablet | none | right | choices: Sugar Control 1mg/500mg Tablet SR; Sugarmet 500 Tablet; Sugarmet 850 Tablet |
| none-headache | headache | none | right | did you mean: Healace Gel; Healace 5mg Tablet; Healace 2.5mg Tablet; Healace H 5mg/12.5mg Tablet |
| none-how-many | how many tablets can I take | none | right | not_found |
| none-hi-sentence | बुखार की दवा | none | right | not_found |
| none-kn-sentence | ಜ್ವರಕ್ಕೆ ಮಾತ್ರೆ | none | right | not_found |
