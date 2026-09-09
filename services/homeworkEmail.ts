import { formatPolishGreeting } from '../utils/polishVocative';

export interface HomeworkConfirmationEmailParams {
  studentName?: string;
  title: string;
  dueDate?: string;
  instructions?: string;
  assignedBy?: string;
  sentences?: Array<any>;
  customNote?: string;
  appUrl?: string;
  unsubscribeUrl?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDate = (value?: string): string => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
};

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
};

/**
 * Buduje spersonalizowaną wiadomość e-mail o nowej pracy domowej
 * z faktycznymi danymi kursanta zaczytanymi z bazy oraz listą zadań.
 */
export function buildHomeworkConfirmationEmail(params: HomeworkConfirmationEmailParams): {
  subject: string;
  html: string;
  text: string;
  greeting: string;
} {
  const {
    studentName,
    title,
    dueDate,
    instructions,
    assignedBy = 'Maciej Wyrozumski',
    sentences = [],
    customNote,
    appUrl = 'https://app.maciej.pro',
    unsubscribeUrl,
  } = params;

  const due = formatDate(dueDate);
  const itemCount = sentences.length;
  const itemsText = `${itemCount} ${plural(itemCount, 'zadanie', 'zadania', 'zadań')}`;
  const greeting = formatPolishGreeting(studentName);

  const cleanTitle = title.trim() || 'Praca domowa';
  const subject = /praca domowa/i.test(cleanTitle)
    ? `Nowe zadanie: ${cleanTitle}`
    : `Nowa praca domowa: ${cleanTitle}`;

  // Lista ćwiczeń do podglądu w mailu
  const previewSentences = sentences.slice(0, 8);
  const hasMore = sentences.length > 8;

  const sentencesHtml = previewSentences.length > 0
    ? `
      <div style="margin:24px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;">
          Zadania w zestawie (${itemCount}):
        </p>
        <ol style="margin:0;padding-left:22px;color:#1e293b;font-size:13.5px;line-height:1.65;">
          ${previewSentences.map((s, idx) => {
            const pl = s.polishSentence || s.question || s.text || s.sentenceWithBlank || (typeof s === 'string' ? s : `Zadanie ${idx + 1}`);
            const hint = s.hint ? ` <span style="color:#64748b;font-size:12px;font-style:italic;">(wskazówka: ${escapeHtml(s.hint)})</span>` : '';
            return `<li style="margin-bottom:6px;"><strong>${escapeHtml(pl)}</strong>${hint}</li>`;
          }).join('')}
        </ol>
        ${hasMore ? `<p style="margin:10px 0 0;font-size:12px;color:#64748b;font-style:italic;">... oraz ${sentences.length - 8} kolejnych zadań w aplikacji.</p>` : ''}
      </div>
    `
    : '';

  const instructionsHtml = instructions
    ? `<div style="margin:18px 0 0;background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Wskazówki od lektora:</p>
         <p style="margin:4px 0 0;color:#14532d;font-size:14px;line-height:1.5;">${escapeHtml(instructions)}</p>
       </div>`
    : '';

  const customNoteHtml = customNote
    ? `<div style="margin:16px 0 0;background:#fefce8;border-left:4px solid #eab308;padding:12px 16px;border-radius:0 8px 8px 0;">
         <p style="margin:0;font-size:12px;font-weight:700;color:#854d0e;text-transform:uppercase;letter-spacing:0.05em;">Wiadomość od lektora:</p>
         <p style="margin:4px 0 0;color:#713f12;font-size:14px;line-height:1.5;">${escapeHtml(customNote)}</p>
       </div>`
    : '';

  const rows = [
    ['Liczba ćwiczeń', itemsText],
    ...(due ? [['Termin wykonania', due]] : []),
    ...(assignedBy ? [['Przypisane przez', assignedBy]] : []),
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  const buttonHtml = appUrl
    ? `<div style="margin:30px 0 0;text-align:center;">
         <a href="${escapeHtml(appUrl)}"
            style="display:inline-block;background:#0f766e;background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%);color:#ffffff;text-decoration:none;
                   padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 12px rgba(13, 148, 136, 0.25);">
           Otwórz zadanie w aplikacji →
         </a>
       </div>`
    : '';

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;">
         Nie chcesz otrzymywać powiadomień?
         <a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;text-decoration:underline;">
           Wypisz się z powiadomień e-mail
         </a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
      <!-- Header Gradient Bar -->
      <tr>
        <td style="background:linear-gradient(90deg, #0d9488, #3b82f6);height:6px;font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 32px 24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <p style="margin:0;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:#0d9488;">CRIBRO ENGLISH</p>
            <span style="font-size:11px;font-weight:600;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;padding:3px 8px;border-radius:999px;">NOWA LEKCJA & ZADANIE</span>
          </div>

          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800;">
            ${escapeHtml(greeting)}
          </h1>

          <p style="margin:0;color:#334155;font-size:15px;line-height:1.65;">
            Lektor przypisał dla Ciebie nową pracę domową:
            <strong style="color:#0f172a;display:block;margin-top:6px;font-size:17px;font-weight:700;">${escapeHtml(cleanTitle)}</strong>
          </p>

          ${instructionsHtml}
          ${customNoteHtml}

          <!-- Podsumowanie tabelaryczne -->
          <div style="margin:24px 0 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </div>

          <!-- Wykaz faktycznych zdań/zadań -->
          ${sentencesHtml}

          <!-- Przycisk CTA -->
          ${buttonHtml}
        </td>
      </tr>

      <!-- Stopka wiadomości (Dedykowana stopka lektora - z możliwością rozbudowy) -->
      <tr>
        <td style="padding:24px 32px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#334155;letter-spacing:0.04em;">
            CRIBRO ENGLISH • Nauka Języka Angielskiego
          </p>
          <p style="margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
            Lekcje indywidualne & spersonalizowana platforma powtórek
          </p>
          <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;line-height:1.5;">
            Wiadomość została wysłana bezpośrednio z panelu lektora po przypisaniu pracy domowej.
          </p>
          ${unsubscribeHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Wersja tekstowa dla klientów pocztowych bez HTML
  const textLines = [
    greeting,
    '',
    `Czeka na Ciebie nowa praca domowa: „${cleanTitle}".`,
    '',
    `Liczba ćwiczeń: ${itemsText}`,
    due ? `Termin wykonania: ${due}` : null,
    assignedBy ? `Przypisane przez: ${assignedBy}` : null,
    instructions ? `\nWskazówki lektora: ${instructions}` : null,
    customNote ? `\nWiadomość od lektora: ${customNote}` : null,
    '',
    sentences.length > 0 ? `Zadania w zestawie (${sentences.length}):` : null,
    ...previewSentences.map((s, idx) => {
      const pl = s.polishSentence || s.question || s.text || s.sentenceWithBlank || (typeof s === 'string' ? s : `Zadanie ${idx + 1}`);
      const hint = s.hint ? ` (wskazówka: ${s.hint})` : '';
      return `${idx + 1}. ${pl}${hint}`;
    }),
    hasMore ? `... oraz ${sentences.length - 8} kolejnych zadań w aplikacji.` : null,
    '',
    `Otwórz zadanie w aplikacji: ${appUrl}`,
    unsubscribeUrl ? `Wypisz się z powiadomień: ${unsubscribeUrl}` : null,
    '',
    '—',
    'CRIBRO ENGLISH • Nauka Języka Angielskiego',
  ].filter((line) => line !== null);

  return {
    subject,
    html,
    text: textLines.join('\n'),
    greeting,
  };
}
