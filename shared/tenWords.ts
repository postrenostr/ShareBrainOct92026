import { z } from "zod";

export const TEN_WORDS_LESSON_COUNT = 50;
export const tenWordsLanguages = [
  { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", direction: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", direction: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", direction: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", direction: "ltr" },
  { code: "zh", name: "Mandarin Chinese", nativeName: "中文", direction: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", direction: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", direction: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", direction: "ltr" },
  { code: "ar", name: "Standard Arabic", nativeName: "العربية", direction: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", direction: "ltr" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", direction: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", direction: "ltr" },
  { code: "en", name: "English", nativeName: "English", direction: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", direction: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", direction: "rtl" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", direction: "ltr" },
  { code: "pcm", name: "Nigerian Pidgin", nativeName: "Naijá", direction: "ltr" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", direction: "ltr" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", direction: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", direction: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", direction: "ltr" },
  { code: "yue", name: "Yue Chinese", nativeName: "粵語", direction: "ltr" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", direction: "ltr" },
  { code: "wuu", name: "Wu Chinese", nativeName: "吴语", direction: "ltr" },
  { code: "ha", name: "Hausa", nativeName: "Hausa", direction: "ltr" },
  { code: "jv", name: "Javanese", nativeName: "Basa Jawa", direction: "ltr" },
  { code: "ar-EG", name: "Egyptian Arabic", nativeName: "العربية المصرية", direction: "rtl" },
  { code: "pnb", name: "Western Punjabi", nativeName: "پنجابی", direction: "rtl" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", direction: "ltr" },
  { code: "fa", name: "Iranian Persian", nativeName: "فارسی", direction: "rtl" },
  { code: "bho", name: "Bhojpuri", nativeName: "भोजपुरी", direction: "ltr" },
  { code: "nan", name: "Southern Min", nativeName: "閩南語", direction: "ltr" },
  { code: "hak", name: "Hakka", nativeName: "客家話", direction: "ltr" },
  { code: "cjy", name: "Jin Chinese", nativeName: "晋语", direction: "ltr" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", direction: "rtl" },
  { code: "su", name: "Sunda", nativeName: "Basa Sunda", direction: "ltr" },
  { code: "dcc", name: "Deccan", nativeName: "دکنی", direction: "rtl" },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", direction: "ltr" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली", direction: "ltr" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာဘာသာ", direction: "ltr" },
  { code: "uz", name: "Uzbek", nativeName: "Oʻzbekcha", direction: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", direction: "ltr" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", direction: "ltr" },
  { code: "th", name: "Thai", nativeName: "ไทย", direction: "ltr" },
  { code: "ro", name: "Romanian", nativeName: "Română", direction: "ltr" },
  { code: "ig", name: "Igbo", nativeName: "Igbo", direction: "ltr" },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycanca", direction: "ltr" },
  { code: "awa", name: "Awadhi", nativeName: "अवधी", direction: "ltr" },
  { code: "gan", name: "Gan Chinese", nativeName: "赣语", direction: "ltr" },
  { code: "ceb", name: "Cebuano", nativeName: "Cebuano", direction: "ltr" },
  { code: "ku", name: "Kurdish", nativeName: "Kurdî", direction: "ltr" },
  { code: "hbs", name: "Serbo-Croatian", nativeName: "Srpskohrvatski", direction: "ltr" },
  { code: "mg", name: "Malagasy", nativeName: "Malagasy", direction: "ltr" },
  { code: "skr", name: "Saraiki", nativeName: "سرائیکی", direction: "rtl" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", direction: "ltr" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල", direction: "ltr" },
  { code: "km", name: "Khmer", nativeName: "ភាសាខ្មែរ", direction: "ltr" },
  { code: "ctg", name: "Chittagonian", nativeName: "চাটগাঁইয়া", direction: "ltr" },
  { code: "zu", name: "Zulu", nativeName: "IsiZulu", direction: "ltr" },
  { code: "ar-IQ", name: "Mesopotamian Arabic", nativeName: "العربية العراقية", direction: "rtl" },
  { code: "mad", name: "Madurese", nativeName: "Madhurâ", direction: "ltr" },
  { code: "so", name: "Somali", nativeName: "Soomaali", direction: "ltr" },
  { code: "mwr", name: "Marwari", nativeName: "मारवाड़ी", direction: "ltr" },
  { code: "mag", name: "Magahi", nativeName: "मगही", direction: "ltr" },
  { code: "bgc", name: "Haryanvi", nativeName: "हरियाणवी", direction: "ltr" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", direction: "ltr" },
  { code: "ny", name: "Chewa", nativeName: "Chichewa", direction: "ltr" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", direction: "ltr" },
  { code: "cs", name: "Czech", nativeName: "Čeština", direction: "ltr" },
  { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda", direction: "ltr" },
  { code: "za", name: "Zhuang", nativeName: "Vahcuengh", direction: "ltr" },
  { code: "prs", name: "Dari", nativeName: "دری", direction: "rtl" },
  { code: "sn", name: "Shona", nativeName: "ChiShona", direction: "ltr" },
  { code: "ug", name: "Uyghur", nativeName: "ئۇيغۇرچە", direction: "rtl" },
  { code: "ak", name: "Akan", nativeName: "Akan", direction: "ltr" },
  { code: "he", name: "Hebrew", nativeName: "עברית", direction: "rtl" },
  { code: "xh", name: "Xhosa", nativeName: "IsiXhosa", direction: "ltr" },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", direction: "ltr" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", direction: "ltr" },
  { code: "da", name: "Danish", nativeName: "Dansk", direction: "ltr" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", direction: "ltr" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", direction: "ltr" },
  { code: "ca", name: "Catalan", nativeName: "Català", direction: "ltr" },
  { code: "lo", name: "Lao", nativeName: "ລາວ", direction: "ltr" },
  { code: "ro-MD", name: "Moldovan", nativeName: "Moldovenească", direction: "ltr" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", direction: "ltr" },
  { code: "sl", name: "Slovene", nativeName: "Slovenščina", direction: "ltr" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", direction: "ltr" },
  { code: "et", name: "Estonian", nativeName: "Eesti", direction: "ltr" },
  { code: "tg", name: "Tajik", nativeName: "Тоҷикӣ", direction: "ltr" },
  { code: "tk", name: "Turkmen", nativeName: "Türkmençe", direction: "ltr" },
  { code: "ti", name: "Tigrinya", nativeName: "ትግርኛ", direction: "ltr" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl ayisyen", direction: "ltr" },
  { code: "qu", name: "Quechua", nativeName: "Runa Simi", direction: "ltr" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", direction: "ltr" },
  { code: "mn", name: "Mongolian", nativeName: "Монгол", direction: "ltr" },
  { code: "ka", name: "Georgian", nativeName: "ქართული", direction: "ltr" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", direction: "ltr" },
] as const;
export type TenWordsLanguage = typeof tenWordsLanguages[number];

const entry = z.string().trim().min(1).max(500).refine(value =>
  !new RegExp(String.raw`[\r\n\p{N}()[\]{}*_#•]`, "u").test(value) &&
  !/^(?:[-–—]|lesson\b|section\b|vocabulary\b|sentences\b)/i.test(value) &&
  !/\s[-–—]\s/.test(value), "Use plain, unnumbered target-language text");
export const tenWordsContentSchema = z.object({
  words: z.array(entry.refine(value => value.length <= 100)).length(10),
  sentences: z.array(entry.refine(value => value.length <= 250)).length(10),
}).strict().refine(lesson => new Set(lesson.words).size === 10, "Vocabulary words must be distinct");
export type TenWordsContent = z.infer<typeof tenWordsContentSchema>;
export interface TenWordsLesson extends TenWordsContent {
  language: string;
  lessonNumber: number;
}
export function lessonText(lesson: TenWordsContent): string {
  return [...lesson.words, "", ...lesson.sentences].join("\n");
}
export function lessonLevel(lessonNumber: number): string {
  return lessonNumber <= 10 ? "Beginner" : lessonNumber <= 25 ? "Everyday" : lessonNumber <= 40 ? "Intermediate" : "Advanced";
}
export function parseLessonCommand(command: string): number | null {
  const match = command.trim().match(/^lesson\s+(\d+)\s*[.!]?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number >= 1 && number <= TEN_WORDS_LESSON_COUNT ? number : null;
}
