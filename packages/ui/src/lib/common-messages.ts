/**
 * The handful of words every module needs and none of them owns.
 *
 * A module cannot reach the app's catalogue, so without this each one carries its own "Save" —
 * six translations of the same word, drifting apart, and six chances for one locale to be missed.
 * These are lifted from the shell's own catalogues rather than written fresh, so they read
 * exactly as they do everywhere else in the product.
 *
 * Registered at import, before any module bundle, so a module may override a key it genuinely
 * means differently — later registrations win.
 *
 * Keep this list short. It is not a general string library: a word only belongs here once more
 * than one module needs it and no module owns its meaning.
 */
import { registerMessages } from './i18n.svelte.js'

const ar = {
  'common.add': 'إضافة',
  'common.archive': 'أرشفة',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.create': 'إنشاء',
  'common.delete': 'حذف',
  'common.discard': 'تجاهل',
  'common.edit': 'تحرير',
  'common.remove': 'إزالة',
  'common.retry': 'إعادة المحاولة',
  'common.save': 'حفظ',
  'common.loading': 'جارٍ التحميل…',
  'common.optional': 'اختياري',
  'common.error': 'حدث خطأ ما. حاول مرة أخرى.',
  'common.any': 'الكل',
  'common.settings': 'الإعدادات',
  'common.system': 'النظام',
  'common.no_data': 'لا شيء لعرضه في هذه الفترة بعد',
  'common.admin': 'الإدارة',
  'common.setting_rows': 'عدد الصفوف',
  'common.setting_status': 'الحالة',
  'common.setting_show': 'إظهار',
}

const de = {
  'common.add': 'Hinzufügen',
  'common.archive': 'Archivieren',
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.create': 'Erstellen',
  'common.delete': 'Löschen',
  'common.discard': 'Verwerfen',
  'common.edit': 'Bearbeiten',
  'common.remove': 'Entfernen',
  'common.retry': 'Erneut versuchen',
  'common.save': 'Speichern',
  'common.loading': 'Wird geladen…',
  'common.optional': 'optional',
  'common.error': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
  'common.any': 'Alle',
  'common.settings': 'Einstellungen',
  'common.system': 'System',
  'common.no_data': 'Für diesen Zeitraum gibt es noch nichts zu zeigen',
  'common.admin': 'Administration',
  'common.setting_rows': 'Zeilen',
  'common.setting_status': 'Status',
  'common.setting_show': 'Anzeigen',
}

const en = {
  'common.add': 'Add',
  'common.archive': 'Archive',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.create': 'Create',
  'common.delete': 'Delete',
  'common.discard': 'Discard',
  'common.edit': 'Edit',
  'common.remove': 'Remove',
  'common.retry': 'Retry',
  'common.save': 'Save',
  'common.loading': 'Loading…',
  'common.optional': 'optional',
  'common.error': 'Something went wrong. Please try again.',
  'common.any': 'Any',
  'common.settings': 'Settings',
  'common.system': 'System',
  'common.no_data': 'Nothing to show for this period yet',
  'common.admin': 'Admin',
  'common.setting_rows': 'Rows',
  'common.setting_status': 'Status',
  'common.setting_show': 'Show',
}

const fa = {
  'common.add': 'افزودن',
  'common.archive': 'بایگانی',
  'common.cancel': 'انصراف',
  'common.close': 'بستن',
  'common.create': 'ایجاد',
  'common.delete': 'حذف',
  'common.discard': 'صرف‌نظر',
  'common.edit': 'ویرایش',
  'common.remove': 'برداشتن',
  'common.retry': 'تلاش دوباره',
  'common.save': 'ذخیره',
  'common.loading': 'در حال بارگذاری…',
  'common.optional': 'اختیاری',
  'common.error': 'مشکلی پیش آمد. دوباره تلاش کنید.',
  'common.any': 'همه',
  'common.settings': 'تنظیمات',
  'common.system': 'سامانه',
  'common.no_data': 'هنوز چیزی برای این بازه نیست',
  'common.admin': 'مدیریت',
  'common.setting_rows': 'تعداد ردیف',
  'common.setting_status': 'وضعیت',
  'common.setting_show': 'نمایش',
}

const tr = {
  'common.add': 'Ekle',
  'common.archive': 'Arşivle',
  'common.cancel': 'Vazgeç',
  'common.close': 'Kapat',
  'common.create': 'Oluştur',
  'common.delete': 'Sil',
  'common.discard': 'Vazgeç',
  'common.edit': 'Düzenle',
  'common.remove': 'Kaldır',
  'common.retry': 'Yeniden dene',
  'common.save': 'Kaydet',
  'common.loading': 'Yükleniyor…',
  'common.optional': 'isteğe bağlı',
  'common.error': 'Bir şeyler ters gitti. Yeniden deneyin.',
  'common.any': 'Herhangi biri',
  'common.settings': 'Ayarlar',
  'common.system': 'Sistem',
  'common.no_data': 'Bu dönem için henüz gösterilecek bir şey yok',
  'common.admin': 'Yönetim',
  'common.setting_rows': 'Satır',
  'common.setting_status': 'Durum',
  'common.setting_show': 'Göster',
}
export const commonMessages: Record<string, Record<string, string>> = {
  ar,
  de,
  en,
  fa,
  tr,
}

for (const [locale, messages] of Object.entries(commonMessages)) registerMessages(locale, messages)
