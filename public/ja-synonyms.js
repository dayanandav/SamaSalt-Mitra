// Salt names as written in the official Jan Aushadhi (PMBI) product list -> the name the brand
// list uses for the SAME medicine (spelling variants, INN/BAN names, typos in the official list,
// and ester or salt names the brand list drops). Used by public/pmbi.js and data/build_ja.py
// (which reads the two JSON blocks below), so both give the same keys.
//
// SAFETY: an entry here makes two names the same medicine. Add one only when it is the same
// active ingredient in the same chemical form (or its strength is always stated as the base).
// Never: metoprolol tartrate = succinate, citalopram = escitalopram, pheniramine =
// chlorpheniramine, perindopril erbumine = arginine (different strengths), insulins, vitamins.
//
// Review: drafted 22 Nov 2026 from the brand-list match check; approved by the owner 22 Nov 2026
// (a pharmacist check is still welcome). Every new entry needs the same review.

export const JA_SYNONYMS = /*SYNONYMS*/{
  "aciclovir": "acyclovir",
  "azilsartan": "azilsartan medoxomil",
  "beclomethasone": "beclometasone",
  "benedipine": "benidipine",
  "bethanechol chloride": "bethanechol",
  "camylofin dihydrochloride": "camylofin",
  "carboxymethlycellulose": "carboxymethylcellulose",
  "cefpodoxime": "cefpodoxime proxetil",
  "cephalexin": "cefalexin",
  "cetirizine dihydrochloride": "cetirizine",
  "cetrizine": "cetirizine",
  "chlorthalidon": "chlortalidone",
  "chlorthalidone": "chlortalidone",
  "ciclopirox olamine": "ciclopirox",
  "co-enzyme q10": "coenzyme q10",
  "cyanocobalamine": "cyanocobalamin",
  "cyclosporin": "ciclosporin",
  "cyclosporine": "ciclosporin",
  "dextromethorphan": "dextromethorphan hydrobromide",
  "di-cloxacillin": "dicloxacillin",
  "di-hydralazine": "dihydralazine",
  "diclofenac dithylamine": "diclofenac diethylamine",
  "docosahexaenoic acid": "docosahexanoic acid",
  "efonidipine ethanolate": "efonidipine",
  "escitalopram oxelate": "escitalopram oxalate",
  "etamsylate": "ethamsylate",
  "ethinylestradiol": "ethinyl estradiol",
  "etophylline": "etofylline",
  "evogliptin tartarate": "evogliptin",
  "flecanide": "flecainide",
  "flunarizine dihydrochloride": "flunarizine",
  "fluoromethalone": "fluorometholone",
  "flupentixol": "flupenthixol",
  "flupentixole": "flupenthixol",
  "glimipride": "glimepiride",
  "guaiphenesin": "guaifenesin",
  "isosorbidemononitrate": "isosorbide mononitrate",
  "ketorolac tromethamine": "ketorolac",
  "levocetirizine dihydrochloride": "levocetirizine",
  "levocetrizine": "levocetirizine",
  "megaldrate": "magaldrate",
  "methyl ergometrine": "methylergometrine",
  "methylsalicylate": "methyl salicylate",
  "metformin hydrchloride": "metformin",
  "miconazole nitrate": "miconazole",
  "mometasone furoate": "mometasone",
  "nimesulid": "nimesulide",
  "nortryptyline": "nortriptyline",
  "octreotide": "octreotide acetate",
  "ofloxaxin": "ofloxacin",
  "olmesartan": "olmesartan medoxomil",
  "opipramol dihydrochloride": "opipramol",
  "oseltamivir": "oseltamivir phosphate",
  "oxybutynin chloride": "oxybutynin",
  "paroxetin": "paroxetine",
  "povidone- iodine": "povidone iodine",
  "povidone-iodine": "povidone iodine",
  "s (-) amlodipine": "s-amlodipine",
  "s- amlodipine": "s-amlodipine",
  "s(-) amlodipine": "s-amlodipine",
  "s(-)amlodipine": "s-amlodipine",
  "selenium sulfide": "selenium sulphide",
  "sertaconazole nitrate": "sertaconazole",
  "silver sulphadiazine": "silver sulfadiazine",
  "somatotropin": "somatropin",
  "tazobactam": "tazobactum",
  "thiocholchicoside": "thiocolchicoside",
  "torsemide": "torasemide",
  "trihexiphenidyl": "trihexyphenidyl",
  "vildaglipitin": "vildagliptin"
}/*END*/;

// Words the official list writes after a salt name that only say where or how it is used
// ("Olopatadine Ophthalmic Solution", "Clotrimazole Vaginal Tablets"): dropped from the salt name.
// Never a form or release word (effervescent, mouth dissolving, delayed release): those change the medicine.
export const JA_ROUTE_WORDS = /*ROUTE_WORDS*/["ophthalmic", "eye", "vaginal", "soft", "skin", "aqueous", "nebuliser", "respirator", "intravenous", "intravenouse", "gastro-resistance"]/*END*/;
