// All user-facing text, in English, Kannada and Hindi. Shared by the web app and the
// Worker (which composes the spoken/written answer). Keep placeholders like {n} intact.
// Kannada and Hindi were written by hand and reviewed with AgentFoundry's SMART-Code
// assistant (see docs/AGENTFOUNDRY.md); corrections from field volunteers are welcome.

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'हिन्दी' },
];

export const STRINGS = {
  en: {
    tagline: 'Same medicine. Lower price.',
    intro: 'Photograph a medicine strip or type its name. SamaSalt-Mitra shows every brand with exactly the same salt and strength, the government Jan Aushadhi price, and the nearest Jan Aushadhi Kendra.',
    scan: 'Scan a medicine strip',
    takePhoto: 'Take a photo',
    useInAppCam: 'Use in-app camera',
    scanHint: 'Take a clear photo of the side with the name and composition.',
    orType: 'or type the name',
    scanTextTip: 'Tip: tap the box below, then use your keyboard’s “Scan text” and point the camera at the strip. It is free and the photo stays on your phone.',
    placeholder: 'e.g. Dolo 650',
    pinLabel: 'PIN code (optional)',
    pinHint: 'Optional. Add a PIN code to see the nearest Jan Aushadhi Kendras.',
    pinShort: 'PIN code',
    check: 'Check',
    useLocation: 'Use my location',
    reading: 'Reading the strip…',
    checking: 'Checking…',
    youHave: 'Your medicine',
    contains: 'Contains',
    sameSaltTitle: 'Same salt, same strength',
    brandsCount: '{n} brands',
    cheapest: 'Lowest-priced brands',
    perUnit: { tablet: 'per tablet', capsule: 'per capsule', ml: 'per ml', unit: 'per unit' },
    packOf: 'Pack of {n}: {price}',
    yours: 'Yours',
    jaTitle: 'Jan Aushadhi generic',
    jaMrp: 'Government MRP',
    jaNone: 'This exact salt and strength is not in the Jan Aushadhi list.',
    jaPending: 'Jan Aushadhi prices are not loaded yet.',
    kendraTitle: 'Nearest Jan Aushadhi Kendras',
    kendraNeedPin: 'Add your PIN code to see the nearest Kendras.',
    kendraNone: 'No Kendra found for this PIN code in the official list.',
    kendraPending: 'The Kendra list is not loaded yet.',
    kendraName: 'Jan Aushadhi Kendra',
    kendraNearby: 'No Kendra with this exact PIN code; these are the closest PIN codes in the official list.',
    jaNti: 'No alternative is suggested for this medicine. Ask your doctor before any change.',
    jaNtiInfo: 'For your information only: Jan Aushadhi sells this same salt and strength. For this medicine, change only if your doctor agrees.',
    jaSource: 'Official PMBJP product list, {date}',
    kendraSource: 'Official Jan Aushadhi Kendra list, {date}',
    directions: 'Directions',
    call: 'Call',
    saveUpTo: 'Save up to {amount} on one pack',
    safety: 'Disclaimer: This information is for reference only and is not medical advice. Only medicines with the same salt, strength and form are shown. Consult your doctor or pharmacist before changing any medicine.',
    nti: 'Caution: This medicine needs an exact dose. Do not change its brand or switch to a generic without consulting your doctor.',
    notFound: 'We could not find this medicine. Type the name exactly as printed on the strip.',
    visionFallback: 'Reading the photo on this phone instead…',
    photoUnreadable: 'Strip details could not be extracted from this image.',
    readNoComposition: 'The salt and strength (for example “Paracetamol IP 650 mg”) were not clear. Photograph the side that lists the composition, close up, in good light. Nothing is suggested from a partial reading.',
    readMismatch: 'The brand name and the salts read from the photo do not match, so the photo may have been misread. Nothing is suggested. Please take the photo again or type the name.',
    readBlurry: 'The photo is not sharp enough to read every letter and number safely. Hold the phone steady, a little closer, in good light, and take it again.',
    retakePhoto: 'Take the photo again',
    checkFailed: 'We could not check this right now. Please check your internet and try again.',
    cropTitle: 'Drag the box over the medicine name and composition',
    cropUse: 'Scan selected area',
    cropFull: 'Scan full photo',
    cropRetake: 'Retake',
    cropCancel: 'Cancel',
    confirmTitle: 'Is this the medicine on your strip?',
    confirmHint: 'Check the name and strength against the strip. Prices and other brands are shown only after you confirm.',
    confirmYes: 'Yes, show prices',
    confirmNo: 'No, take the photo again',
    confirmType: 'Type the name instead',
    visionDown: 'Photo reading is not available right now. Please type the name, or use your keyboard’s “Scan text”.',
    camTitle: 'Point the camera at the medicine name and composition',
    camShoot: 'Take photo',
    camGallery: 'Choose from gallery',
    camUsePhone: 'Use phone camera',
    camBlocked: 'Camera access is blocked for this site. In Chrome, tap the icon to the left of the web address, then Permissions → Camera → Allow. Then tap Try again.',
    camInUse: 'The camera is being used by another app. Close that app, then tap Try again.',
    camNoPicture: 'The camera did not start. Tap Try again, or use your phone camera or a photo from the gallery.',
    camRetry: 'Try again',
    camDenied: 'The camera could not open inside the app. Allow camera access for this site, or use your phone camera or a photo from the gallery.',
    camLost: 'Your phone ran low on memory and closed this page while its camera was open, so the photo was lost. Please try again, or use the in-app camera below: it never leaves this page, so the photo is kept safe.',
    camUseApp: 'Use the in-app camera instead',
    cropPreview: 'This is what will be read (check the name and strength are sharp and complete):',
    readOnStrip: 'Read on the strip: {text}',
    sameSaltNone: 'No other brand has exactly the same salt, strength and form in our list.',
    brandsPending: 'Brand prices are not loaded yet, so other brands cannot be compared.',
    switchQ: 'Will you buy a lower-priced option?',
    switchYes: 'Yes',
    switchAsk: 'Ask my doctor first',
    switchNo: 'No',
    thanks: 'Thank you. This helps us measure real savings.',
    pharmacistBtn: 'Show to the pharmacist',
    pharmacistCard: 'Please give me the lowest-priced medicine with exactly this composition:',
    close: 'Close',
    pharmacistBtnN: 'Show {n} medicines to the pharmacist',
    pharmacistCardMany: 'Please give me the lowest-priced medicines with exactly these compositions:',
    phJa: 'Jan Aushadhi: {name} · Code {code}',
    phNti: 'Same brand only. Do not substitute.',
    ntiWhyTitle: 'Why?',
    ntiWhy: 'For this medicine, even a small difference in how much of the dose reaches the blood matters. Brands are made differently, so changing from one to another (even to a generic with the same salt and strength) can make it work less well or cause side effects: for example, fits (seizures) may come back, or bleeding or clotting problems may occur. Your doctor can change it if needed, with check-ups or blood tests.',
    listRemove: 'Remove',
    listClear: 'Clear list',
    listHint: 'Each medicine you check now is added to this list. It stays only on this phone and is cleared when you close the app.',
    stepsTitle: 'How SamaSalt-Mitra worked this out',
    privacy: 'No photos, names or phone numbers are stored. We count anonymous lookups to measure savings.',
    impactLink: 'See the impact',
    volunteer: 'Volunteer mode',
    volunteerOn: 'Volunteer mode is on: lookups are counted as helped by a volunteer.',
    dataNote: 'Brand prices are printed MRPs from a 2022 dataset and may have changed. Jan Aushadhi prices are from the official PMBJP list ({date}).',
    language: 'Language',
    listen: 'Listen',
    another: 'Check another medicine',
  },

  kn: {
    tagline: 'ಅದೇ ಔಷಧಿ. ಕಡಿಮೆ ಬೆಲೆ.',
    intro: 'ಔಷಧಿ ಸ್ಟ್ರಿಪ್‌ನ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಅದರ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ. ಅದೇ ಸಾಲ್ಟ್ ಮತ್ತು ಅದೇ ಪ್ರಮಾಣದ ಎಲ್ಲಾ ಬ್ರ್ಯಾಂಡ್‌ಗಳು, ಸರ್ಕಾರದ ಜನ ಔಷಧಿ ಬೆಲೆ ಮತ್ತು ಹತ್ತಿರದ ಜನ ಔಷಧಿ ಕೇಂದ್ರವನ್ನು SamaSalt-Mitra ತೋರಿಸುತ್ತದೆ.',
    scan: 'ಔಷಧಿ ಸ್ಟ್ರಿಪ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    takePhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
    useInAppCam: 'ಆ್ಯಪ್ ಕ್ಯಾಮೆರಾ ಬಳಸಿ',
    scanHint: 'ಹೆಸರು ಮತ್ತು ಸಂಯೋಜನೆ ಇರುವ ಭಾಗದ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ.',
    orType: 'ಅಥವಾ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ',
    scanTextTip: 'ಸಲಹೆ: ಕೆಳಗಿನ ಬಾಕ್ಸ್ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ, ನಿಮ್ಮ ಕೀಬೋರ್ಡ್‌ನ “Scan text” ಆಯ್ಕೆ ಮಾಡಿ, ಕ್ಯಾಮೆರಾವನ್ನು ಸ್ಟ್ರಿಪ್ ಕಡೆಗೆ ಹಿಡಿಯಿರಿ. ಇದು ಉಚಿತ, ಫೋಟೋ ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲೇ ಇರುತ್ತದೆ.',
    placeholder: 'ಉದಾ: Dolo 650',
    pinLabel: 'ಪಿನ್ ಕೋಡ್ (ಐಚ್ಛಿಕ)',
    pinHint: 'ಐಚ್ಛಿಕ. ಹತ್ತಿರದ ಜನ ಔಷಧಿ ಕೇಂದ್ರಗಳನ್ನು ನೋಡಲು ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ.',
    pinShort: 'ಪಿನ್ ಕೋಡ್',
    check: 'ಪರಿಶೀಲಿಸಿ',
    useLocation: 'ನನ್ನ ಸ್ಥಳ ಬಳಸಿ',
    reading: 'ಸ್ಟ್ರಿಪ್ ಓದಲಾಗುತ್ತಿದೆ…',
    checking: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…',
    youHave: 'ನಿಮ್ಮ ಔಷಧಿ',
    contains: 'ಇದರಲ್ಲಿ ಇದೆ',
    sameSaltTitle: 'ಅದೇ ಸಾಲ್ಟ್, ಅದೇ ಪ್ರಮಾಣ',
    brandsCount: '{n} ಬ್ರ್ಯಾಂಡ್‌ಗಳು',
    cheapest: 'ಅತಿ ಕಡಿಮೆ ಬೆಲೆಯ ಬ್ರ್ಯಾಂಡ್‌ಗಳು',
    perUnit: { tablet: 'ಪ್ರತಿ ಮಾತ್ರೆಗೆ', capsule: 'ಪ್ರತಿ ಕ್ಯಾಪ್ಸೂಲ್‌ಗೆ', ml: 'ಪ್ರತಿ ಮಿ.ಲೀ.ಗೆ', unit: 'ಪ್ರತಿ ಘಟಕಕ್ಕೆ' },
    packOf: 'ಪ್ಯಾಕ್ ({n}): {price}',
    yours: 'ನಿಮ್ಮದು',
    jaTitle: 'ಜನ ಔಷಧಿ (ಜೆನೆರಿಕ್)',
    jaMrp: 'ಸರ್ಕಾರಿ ಎಂಆರ್‌ಪಿ',
    jaNone: 'ಇದೇ ಸಾಲ್ಟ್ ಮತ್ತು ಇದೇ ಪ್ರಮಾಣದ ಔಷಧಿ ಜನ ಔಷಧಿ ಪಟ್ಟಿಯಲ್ಲಿ ಇಲ್ಲ.',
    jaPending: 'ಜನ ಔಷಧಿ ಬೆಲೆಗಳನ್ನು ಇನ್ನೂ ಸೇರಿಸಿಲ್ಲ.',
    kendraTitle: 'ಹತ್ತಿರದ ಜನ ಔಷಧಿ ಕೇಂದ್ರಗಳು',
    kendraNeedPin: 'ಹತ್ತಿರದ ಕೇಂದ್ರಗಳನ್ನು ನೋಡಲು ನಿಮ್ಮ ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ.',
    kendraNone: 'ಅಧಿಕೃತ ಪಟ್ಟಿಯಲ್ಲಿ ಈ ಪಿನ್ ಕೋಡ್‌ಗೆ ಯಾವುದೇ ಕೇಂದ್ರ ಸಿಗಲಿಲ್ಲ.',
    kendraPending: 'ಕೇಂದ್ರಗಳ ಪಟ್ಟಿಯನ್ನು ಇನ್ನೂ ಸೇರಿಸಿಲ್ಲ.',
    kendraName: 'ಜನ ಔಷಧಿ ಕೇಂದ್ರ',
    kendraNearby: 'ಈ ಪಿನ್ ಕೋಡ್‌ನಲ್ಲಿ ಕೇಂದ್ರ ಇಲ್ಲ; ಅಧಿಕೃತ ಪಟ್ಟಿಯಲ್ಲಿ ಹತ್ತಿರದ ಪಿನ್ ಕೋಡ್‌ಗಳ ಕೇಂದ್ರಗಳು ಇವು.',
    jaNti: 'ಈ ಔಷಧಿಗೆ ಯಾವುದೇ ಬದಲಿಯನ್ನು ಸೂಚಿಸುವುದಿಲ್ಲ. ಏನೇ ಬದಲಾವಣೆಗೂ ಮೊದಲು ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಕೇಳಿ.',
    jaNtiInfo: 'ನಿಮ್ಮ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ: ಜನ ಔಷಧಿ ಇದೇ ಸಾಲ್ಟ್ ಮತ್ತು ಇದೇ ಪ್ರಮಾಣದ ಔಷಧಿಯನ್ನು ಮಾರುತ್ತದೆ. ಈ ಔಷಧಿಗೆ, ನಿಮ್ಮ ವೈದ್ಯರು ಒಪ್ಪಿದರೆ ಮಾತ್ರ ಬದಲಾಯಿಸಿ.',
    jaSource: 'ಅಧಿಕೃತ PMBJP ಔಷಧಿ ಪಟ್ಟಿ, {date}',
    kendraSource: 'ಅಧಿಕೃತ ಜನ ಔಷಧಿ ಕೇಂದ್ರಗಳ ಪಟ್ಟಿ, {date}',
    directions: 'ದಾರಿ ತೋರಿಸಿ',
    call: 'ಕರೆ ಮಾಡಿ',
    saveUpTo: 'ಒಂದು ಪ್ಯಾಕ್‌ನಲ್ಲಿ {amount} ವರೆಗೆ ಉಳಿಸಿ',
    safety: 'ಸೂಚನೆ: ಈ ಮಾಹಿತಿ ಉಲ್ಲೇಖಕ್ಕಾಗಿ ಮಾತ್ರ, ಇದು ವೈದ್ಯಕೀಯ ಸಲಹೆಯಲ್ಲ. ಅದೇ ಸಾಲ್ಟ್, ಅದೇ ಪ್ರಮಾಣ ಮತ್ತು ಅದೇ ರೂಪದ ಔಷಧಿಗಳನ್ನು ಮಾತ್ರ ತೋರಿಸಲಾಗಿದೆ. ಯಾವುದೇ ಔಷಧಿ ಬದಲಾಯಿಸುವ ಮೊದಲು ನಿಮ್ಮ ವೈದ್ಯರು ಅಥವಾ ಫಾರ್ಮಸಿಸ್ಟ್ ಅವರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    nti: 'ಎಚ್ಚರಿಕೆ: ಈ ಔಷಧಿಗೆ ನಿಖರವಾದ ಡೋಸ್ ಬೇಕು. ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸದೆ ಇದರ ಬ್ರ್ಯಾಂಡ್ ಬದಲಾಯಿಸಬೇಡಿ ಅಥವಾ ಜೆನೆರಿಕ್ ಔಷಧಿಗೆ ಬದಲಾಯಿಸಬೇಡಿ.',
    notFound: 'ಈ ಔಷಧಿ ಸಿಗಲಿಲ್ಲ. ಸ್ಟ್ರಿಪ್ ಮೇಲೆ ಮುದ್ರಿಸಿರುವಂತೆಯೇ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ.',
    visionFallback: 'ಫೋಟೋವನ್ನು ಈ ಫೋನ್‌ನಲ್ಲೇ ಓದಲಾಗುತ್ತಿದೆ…',
    photoUnreadable: 'ಈ ಫೋಟೋದಿಂದ ಸ್ಟ್ರಿಪ್ ವಿವರಗಳನ್ನು ಪಡೆಯಲು ಆಗಲಿಲ್ಲ.',
    readNoComposition: 'ಸಾಲ್ಟ್ ಮತ್ತು ಪ್ರಮಾಣ (ಉದಾ: “Paracetamol IP 650 mg”) ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಸಂಯೋಜನೆ ಇರುವ ಭಾಗವನ್ನು ಹತ್ತಿರದಿಂದ, ಒಳ್ಳೆಯ ಬೆಳಕಿನಲ್ಲಿ ಫೋಟೋ ತೆಗೆಯಿರಿ. ಅರ್ಧ ಓದಿದ ವಿವರದಿಂದ ಏನನ್ನೂ ಸೂಚಿಸುವುದಿಲ್ಲ.',
    readMismatch: 'ಫೋಟೋದಲ್ಲಿ ಓದಿದ ಬ್ರ್ಯಾಂಡ್ ಹೆಸರು ಮತ್ತು ಸಾಲ್ಟ್ ಹೊಂದುತ್ತಿಲ್ಲ, ಫೋಟೋ ತಪ್ಪಾಗಿ ಓದಿರಬಹುದು. ಏನನ್ನೂ ಸೂಚಿಸುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ.',
    readBlurry: 'ಪ್ರತಿ ಅಕ್ಷರ ಮತ್ತು ಸಂಖ್ಯೆಯನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಓದುವಷ್ಟು ಫೋಟೋ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಫೋನ್ ಅನ್ನು ಸ್ಥಿರವಾಗಿ, ಸ್ವಲ್ಪ ಹತ್ತಿರ, ಒಳ್ಳೆಯ ಬೆಳಕಿನಲ್ಲಿ ಹಿಡಿದು ಮತ್ತೆ ತೆಗೆಯಿರಿ.',
    retakePhoto: 'ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯಿರಿ',
    checkFailed: 'ಈಗ ಪರಿಶೀಲಿಸಲು ಆಗಲಿಲ್ಲ. ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
    cropTitle: 'ಔಷಧಿಯ ಹೆಸರು ಮತ್ತು ಸಂಯೋಜನೆಯ ಮೇಲೆ ಚೌಕವನ್ನು ಎಳೆದು ಇರಿಸಿ',
    cropUse: 'ಆಯ್ಕೆ ಮಾಡಿದ ಭಾಗ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    cropFull: 'ಪೂರ್ತಿ ಫೋಟೋ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
    cropRetake: 'ಮತ್ತೆ ತೆಗೆಯಿರಿ',
    cropCancel: 'ರದ್ದು ಮಾಡಿ',
    confirmTitle: 'ನಿಮ್ಮ ಸ್ಟ್ರಿಪ್‌ನಲ್ಲಿರುವ ಔಷಧಿ ಇದೇನಾ?',
    confirmHint: 'ಹೆಸರು ಮತ್ತು ಪ್ರಮಾಣವನ್ನು ಸ್ಟ್ರಿಪ್ ಜೊತೆ ಹೋಲಿಸಿ ನೋಡಿ. ನೀವು ಖಚಿತಪಡಿಸಿದ ನಂತರವೇ ಬೆಲೆಗಳು ಮತ್ತು ಬೇರೆ ಬ್ರ್ಯಾಂಡ್‌ಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತದೆ.',
    confirmYes: 'ಹೌದು, ಬೆಲೆಗಳನ್ನು ತೋರಿಸಿ',
    confirmNo: 'ಇಲ್ಲ, ಮತ್ತೆ ಫೋಟೋ ತೆಗೆಯುತ್ತೇನೆ',
    confirmType: 'ಬದಲಿಗೆ ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ',
    visionDown: 'ಈಗ ಫೋಟೋ ಓದಲು ಆಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ಹೆಸರನ್ನು ಟೈಪ್ ಮಾಡಿ, ಅಥವಾ ನಿಮ್ಮ ಕೀಬೋರ್ಡ್‌ನ “Scan text” ಬಳಸಿ.',
    camTitle: 'ಕ್ಯಾಮೆರಾವನ್ನು ಔಷಧಿಯ ಹೆಸರು ಮತ್ತು ಸಂಯೋಜನೆಯ ಕಡೆಗೆ ಹಿಡಿಯಿರಿ',
    camShoot: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
    camGallery: 'ಗ್ಯಾಲರಿಯಿಂದ ಆಯ್ಕೆ ಮಾಡಿ',
    camUsePhone: 'ಫೋನ್ ಕ್ಯಾಮೆರಾ ಬಳಸಿ',
    camBlocked: 'ಈ ಸೈಟ್‌ಗೆ ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ತಡೆಹಿಡಿಯಲಾಗಿದೆ. Chrome ನಲ್ಲಿ ವೆಬ್ ವಿಳಾಸದ ಎಡಭಾಗದ ಚಿಹ್ನೆಯನ್ನು ಒತ್ತಿ, ನಂತರ ಅನುಮತಿಗಳು → ಕ್ಯಾಮೆರಾ → ಅನುಮತಿಸಿ. ನಂತರ "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" ಒತ್ತಿ.',
    camInUse: 'ಕ್ಯಾಮೆರಾವನ್ನು ಬೇರೊಂದು ಆ್ಯಪ್ ಬಳಸುತ್ತಿದೆ. ಆ ಆ್ಯಪ್ ಮುಚ್ಚಿ, ನಂತರ "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" ಒತ್ತಿ.',
    camNoPicture: 'ಕ್ಯಾಮೆರಾ ಆರಂಭವಾಗಲಿಲ್ಲ. "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" ಒತ್ತಿ, ಅಥವಾ ಫೋನ್ ಕ್ಯಾಮೆರಾ ಅಥವಾ ಗ್ಯಾಲರಿಯ ಫೋಟೋ ಬಳಸಿ.',
    camRetry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    camDenied: 'ಆ್ಯಪ್ ಒಳಗೆ ಕ್ಯಾಮೆರಾ ತೆರೆಯಲು ಆಗಲಿಲ್ಲ. ಈ ಸೈಟ್‌ಗೆ ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ನೀಡಿ, ಅಥವಾ ಫೋನ್ ಕ್ಯಾಮೆರಾ ಅಥವಾ ಗ್ಯಾಲರಿಯ ಫೋಟೋ ಬಳಸಿ.',
    camLost: 'ಕ್ಯಾಮೆರಾ ತೆರೆದಿದ್ದಾಗ ಫೋನ್‌ನ ಮೆಮೊರಿ ಕಡಿಮೆಯಾಗಿ ಈ ಪುಟ ಮುಚ್ಚಿಹೋಯಿತು, ಆದ್ದರಿಂದ ಫೋಟೋ ಕಳೆದುಹೋಯಿತು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಕೆಳಗಿನ ಆ್ಯಪ್ ಕ್ಯಾಮೆರಾ ಬಳಸಿ: ಅದು ಈ ಪುಟದಿಂದ ಹೊರಹೋಗುವುದಿಲ್ಲ, ಆದ್ದರಿಂದ ಫೋಟೋ ಸುರಕ್ಷಿತವಾಗಿರುತ್ತದೆ.',
    camUseApp: 'ಬದಲಿಗೆ ಆ್ಯಪ್‌ನ ಕ್ಯಾಮೆರಾ ಬಳಸಿ',
    cropPreview: 'ಓದಲಾಗುವ ಭಾಗ ಇದು (ಹೆಸರು ಮತ್ತು ಪ್ರಮಾಣ ಸ್ಪಷ್ಟವಾಗಿ, ಪೂರ್ತಿಯಾಗಿ ಇದೆಯೇ ನೋಡಿ):',
    readOnStrip: 'ಸ್ಟ್ರಿಪ್ ಮೇಲೆ ಓದಿದ್ದು: {text}',
    sameSaltNone: 'ನಮ್ಮ ಪಟ್ಟಿಯಲ್ಲಿ ಅದೇ ಸಾಲ್ಟ್, ಅದೇ ಪ್ರಮಾಣ ಮತ್ತು ಅದೇ ರೂಪದ ಬೇರೆ ಬ್ರ್ಯಾಂಡ್ ಇಲ್ಲ.',
    brandsPending: 'ಬ್ರ್ಯಾಂಡ್ ಬೆಲೆಗಳನ್ನು ಇನ್ನೂ ಲೋಡ್ ಮಾಡಿಲ್ಲ, ಆದ್ದರಿಂದ ಬೇರೆ ಬ್ರ್ಯಾಂಡ್‌ಗಳೊಂದಿಗೆ ಹೋಲಿಸಲು ಆಗುವುದಿಲ್ಲ.',
    switchQ: 'ನೀವು ಕಡಿಮೆ ಬೆಲೆಯ ಆಯ್ಕೆಯನ್ನು ಖರೀದಿಸುವಿರಾ?',
    switchYes: 'ಹೌದು',
    switchAsk: 'ಮೊದಲು ವೈದ್ಯರನ್ನು ಕೇಳುತ್ತೇನೆ',
    switchNo: 'ಇಲ್ಲ',
    thanks: 'ಧನ್ಯವಾದಗಳು. ನಿಜವಾದ ಉಳಿತಾಯವನ್ನು ಅಳೆಯಲು ಇದು ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
    pharmacistBtn: 'ಫಾರ್ಮಸಿಸ್ಟ್‌ಗೆ ತೋರಿಸಿ',
    pharmacistCard: 'ದಯವಿಟ್ಟು ಇದೇ ಸಂಯೋಜನೆಯ ಅತಿ ಕಡಿಮೆ ಬೆಲೆಯ ಔಷಧಿ ಕೊಡಿ:',
    close: 'ಮುಚ್ಚಿ',
    pharmacistBtnN: '{n} ಔಷಧಿಗಳನ್ನು ಫಾರ್ಮಸಿಸ್ಟ್‌ಗೆ ತೋರಿಸಿ',
    pharmacistCardMany: 'ದಯವಿಟ್ಟು ಇದೇ ಸಂಯೋಜನೆಗಳ ಅತಿ ಕಡಿಮೆ ಬೆಲೆಯ ಔಷಧಿಗಳನ್ನು ಕೊಡಿ:',
    phJa: 'ಜನ ಔಷಧಿ: {name} · ಕೋಡ್ {code}',
    phNti: 'ಇದೇ ಬ್ರ್ಯಾಂಡ್ ಮಾತ್ರ. ಬದಲಿ ಕೊಡಬೇಡಿ.',
    ntiWhyTitle: 'ಏಕೆ?',
    ntiWhy: 'ಈ ಔಷಧಿಯಲ್ಲಿ, ರಕ್ತಕ್ಕೆ ತಲುಪುವ ಡೋಸ್‌ನಲ್ಲಿ ಸಣ್ಣ ವ್ಯತ್ಯಾಸವೂ ಮುಖ್ಯ. ಬ್ರ್ಯಾಂಡ್‌ಗಳು ಬೇರೆ ಬೇರೆ ರೀತಿಯಲ್ಲಿ ತಯಾರಾಗುತ್ತವೆ; ಒಂದರಿಂದ ಇನ್ನೊಂದಕ್ಕೆ ಬದಲಾಯಿಸಿದರೆ (ಅದೇ ಸಾಲ್ಟ್ ಮತ್ತು ಪ್ರಮಾಣದ ಜೆನೆರಿಕ್‌ಗೆ ಬದಲಾಯಿಸಿದರೂ) ಔಷಧಿ ಸರಿಯಾಗಿ ಕೆಲಸ ಮಾಡದಿರಬಹುದು ಅಥವಾ ಅಡ್ಡಪರಿಣಾಮ ಉಂಟಾಗಬಹುದು: ಉದಾಹರಣೆಗೆ, ಫಿಟ್ಸ್ (ಮೂರ್ಛೆ) ಮತ್ತೆ ಬರಬಹುದು, ಅಥವಾ ರಕ್ತಸ್ರಾವ ಅಥವಾ ರಕ್ತ ಹೆಪ್ಪುಗಟ್ಟುವ ಸಮಸ್ಯೆ ಆಗಬಹುದು. ಅಗತ್ಯವಿದ್ದರೆ ನಿಮ್ಮ ವೈದ್ಯರು ತಪಾಸಣೆ ಅಥವಾ ರಕ್ತ ಪರೀಕ್ಷೆಯೊಂದಿಗೆ ಇದನ್ನು ಬದಲಾಯಿಸಬಹುದು.',
    listRemove: 'ತೆಗೆದುಹಾಕಿ',
    listClear: 'ಪಟ್ಟಿ ಖಾಲಿ ಮಾಡಿ',
    listHint: 'ಈಗ ನೀವು ಪರಿಶೀಲಿಸುವ ಪ್ರತಿ ಔಷಧಿ ಈ ಪಟ್ಟಿಗೆ ಸೇರುತ್ತದೆ. ಇದು ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತ್ರ ಇರುತ್ತದೆ ಮತ್ತು ಆ್ಯಪ್ ಮುಚ್ಚಿದಾಗ ಅಳಿಸಲಾಗುತ್ತದೆ.',
    stepsTitle: 'SamaSalt-Mitra ಇದನ್ನು ಹೇಗೆ ಕಂಡುಹಿಡಿಯಿತು',
    privacy: 'ಫೋಟೋ, ಹೆಸರು ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಾವು ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ. ಉಳಿತಾಯ ಅಳೆಯಲು ಹೆಸರಿಲ್ಲದ ಹುಡುಕಾಟಗಳನ್ನು ಮಾತ್ರ ಎಣಿಸುತ್ತೇವೆ.',
    impactLink: 'ಪರಿಣಾಮ ನೋಡಿ',
    volunteer: 'ಸ್ವಯಂಸೇವಕ ಮೋಡ್',
    volunteerOn: 'ಸ್ವಯಂಸೇವಕ ಮೋಡ್ ಆನ್ ಆಗಿದೆ: ಹುಡುಕಾಟಗಳನ್ನು ಸ್ವಯಂಸೇವಕರ ಸಹಾಯವಾಗಿ ಎಣಿಸಲಾಗುತ್ತದೆ.',
    dataNote: 'ಬ್ರ್ಯಾಂಡ್ ಬೆಲೆಗಳು 2022ರ ಡೇಟಾಸೆಟ್‌ನ ಮುದ್ರಿತ ಎಂಆರ್‌ಪಿಗಳು, ಈಗ ಬದಲಾಗಿರಬಹುದು. ಜನ ಔಷಧಿ ಬೆಲೆಗಳು ಅಧಿಕೃತ PMBJP ಪಟ್ಟಿಯಿಂದ ({date}).',
    language: 'ಭಾಷೆ',
    listen: 'ಕೇಳಿ',
    another: 'ಇನ್ನೊಂದು ಔಷಧಿ ಪರಿಶೀಲಿಸಿ',
  },

  hi: {
    tagline: 'वही दवा। कम दाम।',
    intro: 'दवा की पट्टी की फ़ोटो लें या उसका नाम लिखें। SamaSalt-Mitra बिल्कुल वही सॉल्ट और वही मात्रा वाले सभी ब्रांड, जन औषधि की सरकारी कीमत और सबसे नज़दीकी जन औषधि केंद्र दिखाता है।',
    scan: 'दवा की पट्टी स्कैन करें',
    takePhoto: 'फ़ोटो लें',
    useInAppCam: 'ऐप का कैमरा इस्तेमाल करें',
    scanHint: 'नाम और कंपोज़िशन वाले हिस्से की साफ़ फ़ोटो लें।',
    orType: 'या नाम लिखें',
    scanTextTip: 'सुझाव: नीचे के बॉक्स पर टैप करें, फिर अपने कीबोर्ड का “Scan text” चुनें और कैमरा पट्टी की ओर करें। यह मुफ़्त है और फ़ोटो आपके फ़ोन में ही रहती है।',
    placeholder: 'जैसे Dolo 650',
    pinLabel: 'पिन कोड (वैकल्पिक)',
    pinHint: 'वैकल्पिक। सबसे नज़दीकी जन औषधि केंद्र देखने के लिए पिन कोड डालें।',
    pinShort: 'पिन कोड',
    check: 'जाँचें',
    useLocation: 'मेरी लोकेशन इस्तेमाल करें',
    reading: 'पट्टी पढ़ी जा रही है…',
    checking: 'जाँच हो रही है…',
    youHave: 'आपकी दवा',
    contains: 'इसमें है',
    sameSaltTitle: 'वही सॉल्ट, वही मात्रा',
    brandsCount: '{n} ब्रांड',
    cheapest: 'सबसे कम दाम वाले ब्रांड',
    perUnit: { tablet: 'प्रति गोली', capsule: 'प्रति कैप्सूल', ml: 'प्रति ml', unit: 'प्रति यूनिट' },
    packOf: 'पैक ({n}): {price}',
    yours: 'आपकी',
    jaTitle: 'जन औषधि (जेनेरिक)',
    jaMrp: 'सरकारी MRP',
    jaNone: 'यही सॉल्ट और मात्रा जन औषधि सूची में नहीं है।',
    jaPending: 'जन औषधि के दाम अभी जोड़े नहीं गए हैं।',
    kendraTitle: 'सबसे नज़दीकी जन औषधि केंद्र',
    kendraNeedPin: 'नज़दीकी केंद्र देखने के लिए अपना पिन कोड डालें।',
    kendraNone: 'आधिकारिक सूची में इस पिन कोड के लिए कोई केंद्र नहीं मिला।',
    kendraPending: 'केंद्रों की सूची अभी जोड़ी नहीं गई है।',
    kendraName: 'जन औषधि केंद्र',
    kendraNearby: 'इस पिन कोड पर कोई केंद्र नहीं है; ये आधिकारिक सूची में सबसे नज़दीकी पिन कोड वाले केंद्र हैं।',
    jaNti: 'इस दवा के लिए कोई विकल्प नहीं सुझाया जाता। कोई भी बदलाव करने से पहले अपने डॉक्टर से पूछें।',
    jaNtiInfo: 'केवल आपकी जानकारी के लिए: जन औषधि यही सॉल्ट और यही मात्रा बेचता है। इस दवा के लिए, बदलाव तभी करें जब आपके डॉक्टर सहमत हों।',
    jaSource: 'आधिकारिक PMBJP दवा सूची, {date}',
    kendraSource: 'आधिकारिक जन औषधि केंद्र सूची, {date}',
    directions: 'रास्ता देखें',
    call: 'कॉल करें',
    saveUpTo: 'एक पैक पर {amount} तक बचाएँ',
    safety: 'अस्वीकरण: यह जानकारी केवल संदर्भ के लिए है, चिकित्सा सलाह नहीं। सिर्फ़ वही सॉल्ट, वही मात्रा और वही रूप वाली दवाएँ दिखाई गई हैं। कोई भी दवा बदलने से पहले अपने डॉक्टर या फ़ार्मासिस्ट से सलाह लें।',
    nti: 'सावधानी: इस दवा की खुराक बिल्कुल सटीक होनी चाहिए। अपने डॉक्टर से सलाह लिए बिना इसका ब्रांड न बदलें और न ही जेनेरिक दवा पर जाएँ।',
    notFound: 'यह दवा नहीं मिली। पट्टी पर जैसा छपा है, वैसा ही नाम लिखें।',
    visionFallback: 'फ़ोटो इसी फ़ोन पर पढ़ी जा रही है…',
    photoUnreadable: 'इस फ़ोटो से पट्टी की जानकारी नहीं निकाली जा सकी।',
    readNoComposition: 'सॉल्ट और मात्रा (जैसे “Paracetamol IP 650 mg”) साफ़ नहीं थे। कंपोज़िशन वाले हिस्से की पास से, अच्छी रोशनी में फ़ोटो लें। अधूरी जानकारी से कुछ भी सुझाया नहीं जाता।',
    readMismatch: 'फ़ोटो में पढ़ा गया ब्रांड नाम और सॉल्ट आपस में मेल नहीं खाते, फ़ोटो गलत पढ़ी गई हो सकती है। कुछ भी सुझाया नहीं गया। कृपया फिर से फ़ोटो लें या नाम लिखें।',
    readBlurry: 'फ़ोटो इतनी साफ़ नहीं है कि हर अक्षर और अंक सुरक्षित रूप से पढ़ा जा सके। फ़ोन स्थिर रखें, थोड़ा पास से, अच्छी रोशनी में फिर से लें।',
    retakePhoto: 'फिर से फ़ोटो लें',
    checkFailed: 'अभी जाँच नहीं हो सकी। अपना इंटरनेट देखें और फिर कोशिश करें।',
    cropTitle: 'बॉक्स को दवा के नाम और कंपोज़िशन पर खींचकर रखें',
    cropUse: 'चुना हुआ हिस्सा स्कैन करें',
    cropFull: 'पूरी फ़ोटो स्कैन करें',
    cropRetake: 'फिर से फ़ोटो लें',
    cropCancel: 'रद्द करें',
    confirmTitle: 'क्या आपकी पट्टी पर यही दवा है?',
    confirmHint: 'नाम और मात्रा को पट्टी से मिलाकर देखें। आपके पुष्टि करने के बाद ही दाम और दूसरे ब्रांड दिखाए जाते हैं।',
    confirmYes: 'हाँ, दाम दिखाएँ',
    confirmNo: 'नहीं, फिर से फ़ोटो लूँगा',
    confirmType: 'इसकी जगह नाम लिखें',
    visionDown: 'अभी फ़ोटो पढ़ी नहीं जा सकती। कृपया नाम लिखें, या अपने कीबोर्ड का “Scan text” इस्तेमाल करें।',
    camTitle: 'कैमरा दवा के नाम और कंपोज़िशन की ओर करें',
    camShoot: 'फ़ोटो लें',
    camGallery: 'गैलरी से चुनें',
    camUsePhone: 'फ़ोन का कैमरा इस्तेमाल करें',
    camBlocked: 'इस साइट के लिए कैमरा की अनुमति बंद है। Chrome में वेब पते के बाईं ओर वाले चिह्न पर टैप करें, फिर अनुमतियाँ → कैमरा → अनुमति दें। फिर "फिर से कोशिश करें" पर टैप करें।',
    camInUse: 'कैमरा किसी दूसरे ऐप में चल रहा है। उस ऐप को बंद करें, फिर "फिर से कोशिश करें" पर टैप करें।',
    camNoPicture: 'कैमरा शुरू नहीं हुआ। "फिर से कोशिश करें" पर टैप करें, या फ़ोन का कैमरा या गैलरी की फ़ोटो इस्तेमाल करें।',
    camRetry: 'फिर से कोशिश करें',
    camDenied: 'ऐप के अंदर कैमरा नहीं खुल सका। इस साइट को कैमरा की अनुमति दें, या फ़ोन का कैमरा या गैलरी की फ़ोटो इस्तेमाल करें।',
    camLost: 'कैमरा खुला होने पर फ़ोन की मेमोरी कम हो गई और यह पेज बंद हो गया, इसलिए फ़ोटो खो गई। फिर से कोशिश करें, या नीचे ऐप का कैमरा इस्तेमाल करें: वह इस पेज से बाहर नहीं जाता, इसलिए फ़ोटो सुरक्षित रहती है।',
    camUseApp: 'इसकी जगह ऐप का कैमरा इस्तेमाल करें',
    cropPreview: 'यही हिस्सा पढ़ा जाएगा (देखें कि नाम और मात्रा साफ़ और पूरे हैं):',
    readOnStrip: 'पट्टी पर पढ़ा गया: {text}',
    sameSaltNone: 'हमारी सूची में बिल्कुल वही सॉल्ट, वही मात्रा और वही रूप वाला कोई दूसरा ब्रांड नहीं है।',
    brandsPending: 'ब्रांड के दाम अभी लोड नहीं हुए हैं, इसलिए दूसरे ब्रांड से तुलना नहीं हो सकती।',
    switchQ: 'क्या आप कम दाम वाला विकल्प ख़रीदेंगे?',
    switchYes: 'हाँ',
    switchAsk: 'पहले डॉक्टर से पूछना है',
    switchNo: 'नहीं',
    thanks: 'धन्यवाद। इससे असली बचत मापने में मदद मिलती है।',
    pharmacistBtn: 'फ़ार्मासिस्ट को दिखाएँ',
    pharmacistCard: 'कृपया बिल्कुल इसी सॉल्ट और मात्रा वाली सबसे सस्ती दवा दें:',
    close: 'बंद करें',
    pharmacistBtnN: '{n} दवाएँ फ़ार्मासिस्ट को दिखाएँ',
    pharmacistCardMany: 'कृपया बिल्कुल इन्हीं सॉल्ट और मात्रा वाली सबसे सस्ती दवाएँ दें:',
    phJa: 'जन औषधि: {name} · कोड {code}',
    phNti: 'सिर्फ़ यही ब्रांड। बदलकर न दें।',
    ntiWhyTitle: 'क्यों?',
    ntiWhy: 'इस दवा में, खून तक पहुँचने वाली खुराक का थोड़ा-सा अंतर भी मायने रखता है। हर ब्रांड अलग तरीके से बनता है, इसलिए एक से दूसरे पर जाने से (उसी सॉल्ट और मात्रा वाली जेनेरिक दवा पर भी) दवा कम असर कर सकती है या साइड इफ़ेक्ट हो सकते हैं: जैसे दौरे (फिट्स) फिर से आ सकते हैं, या खून बहने या थक्का जमने की समस्या हो सकती है। ज़रूरत हो तो आपके डॉक्टर जाँच या खून की जाँच के साथ इसे बदल सकते हैं।',
    listRemove: 'हटाएँ',
    listClear: 'सूची खाली करें',
    listHint: 'अभी आप जो भी दवा जाँचते हैं, वह इस सूची में जुड़ जाती है। यह सिर्फ़ इसी फ़ोन पर रहती है और ऐप बंद करने पर मिट जाती है।',
    stepsTitle: 'SamaSalt-Mitra ने यह कैसे पता लगाया',
    privacy: 'हम फ़ोटो, नाम या फ़ोन नंबर नहीं रखते। बचत मापने के लिए सिर्फ़ बिना नाम की खोजें गिनते हैं।',
    impactLink: 'असर देखें',
    volunteer: 'स्वयंसेवक मोड',
    volunteerOn: 'स्वयंसेवक मोड चालू है: खोजों को स्वयंसेवक की मदद माना जाएगा।',
    dataNote: 'ब्रांड के दाम 2022 के डेटासेट से लिए गए छपे हुए MRP हैं और अब बदल चुके हो सकते हैं। जन औषधि के दाम आधिकारिक PMBJP सूची ({date}) से हैं।',
    language: 'भाषा',
    listen: 'सुनें',
    another: 'दूसरी दवा जाँचें',
  },
};

export function t(lang, key, vars = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  let s = table[key] ?? STRINGS.en[key] ?? key;
  if (typeof s !== 'string') return s;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function rupees(x, digits = 2) {
  if (x == null || !Number.isFinite(+x)) return '—';
  const v = +x;
  // Under ₹100: paise shown exactly (₹15.47, ₹0.33); trailing .00 dropped. ₹100 and up: whole rupees.
  return '₹' + (v >= 100 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(digits).replace(/\.00$/, ''));
}

export function unitKind(form) {
  if (form === 'tablet' || form === 'chewable' || form === 'effervescent') return 'tablet';
  if (form === 'capsule') return 'capsule';
  if (form === 'liquid' || form === 'dry_syrup' || form === 'drops') return 'ml';
  return 'unit';
}

/**
 * The agent's final answer, composed from verified facts only (no free-form generation),
 * so every number and every safety line is the same in all three languages.
 * facts: { brand, composition, count, cheapBrand, cheapUnit, yourUnit, jaName, jaUnit, saving, pack, form, nti }
 */
/** Why the answer has no cheaper option, or null when it has one: the person should never be left guessing. */
export function noOption(f) {
  if (f.nti || f.cheapBrand || f.jaUnit != null) return null;
  if (f.brandsLoaded === false) return 'notLoaded';
  if (f.count > 1) return 'cheapest';
  return 'none';
}

export function composeAnswer(lang, f) {
  const unit = unitKind(f.form);
  const per = t(lang, 'perUnit')[unit];
  const L = [];
  if (lang === 'kn') {
    if (f.brand !== f.composition) L.push(`${f.brand} ನಲ್ಲಿ ${f.composition} ಇದೆ.`);
    if (f.nti) { L.push(t('kn', 'nti')); return L.join(' '); }
    if (f.count > 1) L.push(`ಅದೇ ಸಾಲ್ಟ್ ಮತ್ತು ಅದೇ ಪ್ರಮಾಣದ ${Number(f.count).toLocaleString('en-IN')} ಬ್ರ್ಯಾಂಡ್‌ಗಳಿವೆ.`);
    if (f.cheapBrand && f.yourUnit != null) L.push(`ಅತಿ ಕಡಿಮೆ ಬೆಲೆ ${f.cheapBrand}: ${per} ${rupees(f.cheapUnit)}. ${f.brand}: ${per} ${rupees(f.yourUnit)}.`);
    else if (f.cheapBrand) L.push(`ಅತಿ ಕಡಿಮೆ ಬೆಲೆ ${f.cheapBrand}: ${per} ${rupees(f.cheapUnit)}.`);
    if (f.jaUnit != null) L.push(`ಜನ ಔಷಧಿ ಕೇಂದ್ರದಲ್ಲಿ ${f.jaName}: ${per} ${rupees(f.jaUnit)}.`);
    if (noOption(f) === 'notLoaded') L.push('ಬ್ರ್ಯಾಂಡ್ ಬೆಲೆಗಳನ್ನು ಇನ್ನೂ ಲೋಡ್ ಮಾಡಿಲ್ಲ, ಆದ್ದರಿಂದ ಬೇರೆ ಬ್ರ್ಯಾಂಡ್‌ಗಳೊಂದಿಗೆ ಹೋಲಿಸಲು ಆಗುವುದಿಲ್ಲ.');
    if (noOption(f) === 'cheapest') L.push('ಇದು ಈಗಾಗಲೇ ಈ ಬ್ರ್ಯಾಂಡ್‌ಗಳಲ್ಲಿ ಅತಿ ಕಡಿಮೆ ಬೆಲೆಯದು.');
    if (noOption(f) === 'none') L.push('ಅದೇ ಸಾಲ್ಟ್, ಅದೇ ಪ್ರಮಾಣ ಮತ್ತು ಅದೇ ರೂಪದ ಬೇರೆ ಬ್ರ್ಯಾಂಡ್ ಸಿಗಲಿಲ್ಲ.');
    if (f.saving > 0) L.push(`ಒಂದು ಪ್ಯಾಕ್ (${f.pack}) ಮೇಲೆ ಸುಮಾರು ${rupees(f.saving)} ಉಳಿಸಬಹುದು.`);
    L.push('ಬದಲಾಯಿಸುವ ಮೊದಲು ನಿಮ್ಮ ವೈದ್ಯರು ಅಥವಾ ಫಾರ್ಮಸಿಸ್ಟ್ ಅವರನ್ನು ಕೇಳಿ.');
  } else if (lang === 'hi') {
    if (f.brand !== f.composition) L.push(`${f.brand} में ${f.composition} है।`);
    if (f.nti) { L.push(t('hi', 'nti')); return L.join(' '); }
    if (f.count > 1) L.push(`बिल्कुल वही सॉल्ट और वही मात्रा वाले ${Number(f.count).toLocaleString('en-IN')} ब्रांड हैं।`);
    if (f.cheapBrand && f.yourUnit != null) L.push(`सबसे कम दाम ${f.cheapBrand} का है: ${per} ${rupees(f.cheapUnit)}, जबकि ${f.brand} ${per} ${rupees(f.yourUnit)} की है।`);
    else if (f.cheapBrand) L.push(`सबसे कम दाम ${f.cheapBrand} का है: ${per} ${rupees(f.cheapUnit)}।`);
    if (f.jaUnit != null) L.push(`जन औषधि केंद्र पर ${f.jaName}: ${per} ${rupees(f.jaUnit)}।`);
    if (noOption(f) === 'notLoaded') L.push('ब्रांड के दाम अभी लोड नहीं हुए हैं, इसलिए दूसरे ब्रांड से तुलना नहीं हो सकती।');
    if (noOption(f) === 'cheapest') L.push('यह पहले से ही इन ब्रांडों में सबसे कम दाम वाली है।');
    if (noOption(f) === 'none') L.push('बिल्कुल वही सॉल्ट, वही मात्रा और वही रूप वाला कोई दूसरा ब्रांड नहीं मिला।');
    if (f.saving > 0) L.push(`एक पैक (${f.pack}) पर लगभग ${rupees(f.saving)} बच सकते हैं।`);
    L.push('दवा बदलने से पहले अपने डॉक्टर या फ़ार्मासिस्ट से पूछें।');
  } else {
    if (f.brand !== f.composition) L.push(`${f.brand} contains ${f.composition}.`);
    if (f.nti) { L.push(t('en', 'nti')); return L.join(' '); }
    if (f.count > 1) L.push(`${Number(f.count).toLocaleString('en-IN')} brands have exactly the same salt and strength.`);
    if (f.cheapBrand && f.yourUnit != null) L.push(`The lowest-priced is ${f.cheapBrand} at ${rupees(f.cheapUnit)} ${per}, against ${rupees(f.yourUnit)} for ${f.brand}.`);
    else if (f.cheapBrand) L.push(`The lowest-priced is ${f.cheapBrand} at ${rupees(f.cheapUnit)} ${per}.`);
    if (f.jaUnit != null) L.push(`At a Jan Aushadhi Kendra, ${f.jaName} costs ${rupees(f.jaUnit)} ${per}.`);
    if (noOption(f) === 'notLoaded') L.push('Brand prices are not loaded yet, so other brands cannot be compared.');
    if (noOption(f) === 'cheapest') L.push('It is already the lowest-priced of these brands.');
    if (noOption(f) === 'none') L.push('No other brand with exactly the same salt, strength and form was found.');
    if (f.saving > 0) L.push(`That can save about ${rupees(f.saving)} on one pack of ${f.pack}.`);
    L.push('Please check with your doctor or pharmacist before switching.');
  }
  return L.join(' ');
}
