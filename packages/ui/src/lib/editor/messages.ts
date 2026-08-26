/**
 * What the editor's own menus say.
 *
 * The `common.*` bundle next door is for words no module owns; these are owned by the editor and
 * there are two dozen of them, so they live here rather than growing that list past its purpose.
 * Same mechanism: registered at import, before any module bundle, so an app may override a label
 * it genuinely means differently.
 *
 * Registered by `editor/index.ts`, which is the entry every consumer of the editor goes through.
 *
 * "Mention someone" is deliberately absent — `common.mention` already says it in all five
 * languages, and one English phrase gets one translation everywhere.
 */
import { registerMessages } from '../i18n.svelte.js'

const ar = {
  'editor.group_basic': 'أساسي',
  'editor.group_lists': 'القوائم',
  'editor.group_blocks': 'الكتل',
  'editor.group_insert': 'إدراج',
  'editor.block_text': 'نص',
  'editor.block_heading': 'عنوان {level}',
  'editor.block_bullet_list': 'قائمة نقطية',
  'editor.block_ordered_list': 'قائمة مرقّمة',
  'editor.block_task_list': 'قائمة مهام',
  'editor.block_quote': 'اقتباس',
  'editor.block_code': 'كتلة كود',
  'editor.block_table': 'جدول',
  'editor.block_toggle': 'قسم قابل للطي',
  'editor.block_divider': 'فاصل',
  'editor.block_image': 'صورة',
  'editor.callout_info': 'مربع معلومات',
  'editor.callout_note': 'مربع ملاحظة',
  'editor.callout_success': 'مربع نجاح',
  'editor.callout_warning': 'مربع تحذير',
  'editor.callout_danger': 'مربع خطر',
  'editor.insert_page_link': 'ربط صفحة',
  'editor.menu_blocks': 'الكتل',
  'editor.menu_people': 'الأشخاص',
  'editor.menu_pages': 'الصفحات',
  'editor.menu_empty': 'لا توجد نتائج مطابقة',
}

const de = {
  'editor.group_basic': 'Grundlagen',
  'editor.group_lists': 'Listen',
  'editor.group_blocks': 'Blöcke',
  'editor.group_insert': 'Einfügen',
  'editor.block_text': 'Text',
  'editor.block_heading': 'Überschrift {level}',
  'editor.block_bullet_list': 'Aufzählung',
  'editor.block_ordered_list': 'Nummerierte Liste',
  'editor.block_task_list': 'Aufgabenliste',
  'editor.block_quote': 'Zitat',
  'editor.block_code': 'Codeblock',
  'editor.block_table': 'Tabelle',
  'editor.block_toggle': 'Ausklappbarer Abschnitt',
  'editor.block_divider': 'Trennlinie',
  'editor.block_image': 'Bild',
  'editor.callout_info': 'Infobox',
  'editor.callout_note': 'Notizbox',
  'editor.callout_success': 'Erfolgsbox',
  'editor.callout_warning': 'Warnbox',
  'editor.callout_danger': 'Gefahrenbox',
  'editor.insert_page_link': 'Seite verlinken',
  'editor.menu_blocks': 'Blöcke',
  'editor.menu_people': 'Personen',
  'editor.menu_pages': 'Seiten',
  'editor.menu_empty': 'Keine Treffer',
}

const en = {
  'editor.group_basic': 'Basic',
  'editor.group_lists': 'Lists',
  'editor.group_blocks': 'Blocks',
  'editor.group_insert': 'Insert',
  'editor.block_text': 'Text',
  'editor.block_heading': 'Heading {level}',
  'editor.block_bullet_list': 'Bulleted list',
  'editor.block_ordered_list': 'Numbered list',
  'editor.block_task_list': 'Task list',
  'editor.block_quote': 'Quote',
  'editor.block_code': 'Code block',
  'editor.block_table': 'Table',
  'editor.block_toggle': 'Toggle',
  'editor.block_divider': 'Divider',
  'editor.block_image': 'Image',
  'editor.callout_info': 'Info callout',
  'editor.callout_note': 'Note callout',
  'editor.callout_success': 'Success callout',
  'editor.callout_warning': 'Warning callout',
  'editor.callout_danger': 'Danger callout',
  'editor.insert_page_link': 'Link a page',
  'editor.menu_blocks': 'Blocks',
  'editor.menu_people': 'People',
  'editor.menu_pages': 'Pages',
  'editor.menu_empty': 'Nothing matches that',
}

const fa = {
  'editor.group_basic': 'پایه',
  'editor.group_lists': 'فهرست‌ها',
  'editor.group_blocks': 'بلوک‌ها',
  'editor.group_insert': 'افزودن',
  'editor.block_text': 'متن',
  'editor.block_heading': 'عنوان {level}',
  'editor.block_bullet_list': 'فهرست نقطه‌ای',
  'editor.block_ordered_list': 'فهرست شماره‌دار',
  'editor.block_task_list': 'فهرست کارها',
  'editor.block_quote': 'نقل‌قول',
  'editor.block_code': 'بلوک کد',
  'editor.block_table': 'جدول',
  'editor.block_toggle': 'بخش تاشو',
  'editor.block_divider': 'خط جداکننده',
  'editor.block_image': 'تصویر',
  'editor.callout_info': 'کادر اطلاعات',
  'editor.callout_note': 'کادر یادداشت',
  'editor.callout_success': 'کادر موفقیت',
  'editor.callout_warning': 'کادر هشدار',
  'editor.callout_danger': 'کادر خطر',
  'editor.insert_page_link': 'پیوند به صفحه',
  'editor.menu_blocks': 'بلوک‌ها',
  'editor.menu_people': 'افراد',
  'editor.menu_pages': 'صفحه‌ها',
  'editor.menu_empty': 'چیزی با این عبارت پیدا نشد',
}

const tr = {
  'editor.group_basic': 'Temel',
  'editor.group_lists': 'Listeler',
  'editor.group_blocks': 'Bloklar',
  'editor.group_insert': 'Ekle',
  'editor.block_text': 'Metin',
  'editor.block_heading': 'Başlık {level}',
  'editor.block_bullet_list': 'Madde işaretli liste',
  'editor.block_ordered_list': 'Numaralı liste',
  'editor.block_task_list': 'Görev listesi',
  'editor.block_quote': 'Alıntı',
  'editor.block_code': 'Kod bloğu',
  'editor.block_table': 'Tablo',
  'editor.block_toggle': 'Katlanır bölüm',
  'editor.block_divider': 'Ayırıcı',
  'editor.block_image': 'Görsel',
  'editor.callout_info': 'Bilgi kutusu',
  'editor.callout_note': 'Not kutusu',
  'editor.callout_success': 'Başarı kutusu',
  'editor.callout_warning': 'Uyarı kutusu',
  'editor.callout_danger': 'Tehlike kutusu',
  'editor.insert_page_link': 'Sayfa bağla',
  'editor.menu_blocks': 'Bloklar',
  'editor.menu_people': 'Kişiler',
  'editor.menu_pages': 'Sayfalar',
  'editor.menu_empty': 'Eşleşen bir şey yok',
}

export const editorMessages: Record<string, Record<string, string>> = { ar, de, en, fa, tr }

for (const [locale, messages] of Object.entries(editorMessages)) registerMessages(locale, messages)
