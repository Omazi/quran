/**
 * The words of the recovery screens, in the three languages of the app. They sit here, not in the
 * translation files, on purpose: the error screen must be able to speak when the app failed
 * before its translations or its store were ready, and it must not depend on either.
 * French is the reference.
 */

export interface DiagnosticsCopy {
  title: string;
  body: string;
  retry: string;
  details: string;
  share: string;
  sheetTitle: string;
  sheetBody: string;
  clear: string;
  close: string;
  settingsTitle: string;
  settingsRow: string;
  settingsNone: string;
  settingsFooter: string;
}

const fr: DiagnosticsCopy = {
  title: 'Un problème est survenu.',
  body: 'Tu peux réessayer. Si ça recommence, envoie-nous ce qui est écrit plus bas : ça nous aide à corriger.',
  retry: 'Réessayer',
  details: 'Détails techniques',
  share: 'Copier ou envoyer',
  sheetTitle: "L'app s'est fermée la dernière fois",
  sheetBody:
    "Voici ce que l'app a noté juste avant. Envoie-le nous, ça nous aide à trouver la cause. Rien n'est envoyé sans toi.",
  clear: 'Effacer',
  close: 'Fermer',
  settingsTitle: 'Diagnostic',
  settingsRow: 'Dernière fermeture inattendue',
  settingsNone: 'Aucune fermeture notée par l’app.',
  settingsFooter:
    'Ces informations restent sur ton téléphone. Tu choisis de les copier ou de les envoyer.',
};

const en: DiagnosticsCopy = {
  title: 'Something went wrong.',
  body: 'You can try again. If it keeps happening, send us what is written below: it helps us fix it.',
  retry: 'Try again',
  details: 'Technical details',
  share: 'Copy or send',
  sheetTitle: 'The app closed last time',
  sheetBody:
    'This is what the app noted just before. Send it to us, it helps us find the cause. Nothing is sent without you.',
  clear: 'Clear',
  close: 'Close',
  settingsTitle: 'Diagnostics',
  settingsRow: 'Last unexpected closure',
  settingsNone: 'The app has not noted any closure.',
  settingsFooter: 'This stays on your phone. You choose whether to copy or send it.',
};

const ar: DiagnosticsCopy = {
  title: 'حدثت مشكلة.',
  body: 'يمكنك المحاولة مرة أخرى. إذا تكرّر الأمر، أرسل لنا ما هو مكتوب أدناه، فهذا يساعدنا على الإصلاح.',
  retry: 'حاول مرة أخرى',
  details: 'تفاصيل تقنية',
  share: 'نسخ أو إرسال',
  sheetTitle: 'أُغلق التطبيق في المرة الماضية',
  sheetBody:
    'هذا ما سجّله التطبيق قبل إغلاقه مباشرة. أرسله لنا، فهو يساعدنا على معرفة السبب. لا يُرسَل شيء دون موافقتك.',
  clear: 'مسح',
  close: 'إغلاق',
  settingsTitle: 'التشخيص',
  settingsRow: 'آخر إغلاق غير متوقع',
  settingsNone: 'لم يسجّل التطبيق أي إغلاق.',
  settingsFooter: 'تبقى هذه المعلومات على هاتفك. أنت تقرر هل تنسخها أو ترسلها.',
};

export const COPY = { fr, en, ar } as const;

/** The words for a language code; French for any language the app does not have. */
export function copyFor(language: string | null | undefined): DiagnosticsCopy {
  return language === 'en' || language === 'ar' ? COPY[language] : COPY.fr;
}
