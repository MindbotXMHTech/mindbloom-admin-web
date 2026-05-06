type LocalizedText = {
  th: string;
  en: string;
};

export type PsychologistTopicKey = string;

export type PsychologistTopicOption = {
  key: PsychologistTopicKey;
  label: LocalizedText;
  is_custom: boolean;
  sort_order: number;
};

export const defaultPsychologistTopicOptions: PsychologistTopicOption[] = [
  { key: "relationships", label: { th: "ความสัมพันธ์", en: "Relationships" }, is_custom: false, sort_order: 0 },
  { key: "adjustment", label: { th: "การปรับตัว", en: "Adjustment" }, is_custom: false, sort_order: 1 },
  { key: "emotions", label: { th: "อารมณ์", en: "Emotions" }, is_custom: false, sort_order: 2 },
  { key: "burnout", label: { th: "Burnout", en: "Burnout" }, is_custom: false, sort_order: 3 },
  { key: "behavior", label: { th: "พฤติกรรม", en: "Behavior" }, is_custom: false, sort_order: 4 },
  { key: "couple", label: { th: "คู่รัก/สมรส", en: "Couple / Marriage" }, is_custom: false, sort_order: 5 },
  { key: "learning", label: { th: "การเรียน", en: "Learning" }, is_custom: false, sort_order: 6 },
  { key: "friends", label: { th: "เพื่อน", en: "Friends" }, is_custom: false, sort_order: 7 },
  { key: "parenting", label: { th: "การเลี้ยงดู", en: "Parenting" }, is_custom: false, sort_order: 8 },
  { key: "child_adolescent", label: { th: "เด็ก & วัยรุ่น", en: "Child & Adolescent" }, is_custom: false, sort_order: 9 },
  { key: "substance", label: { th: "สารเสพติด", en: "Substance Use" }, is_custom: false, sort_order: 10 },
  { key: "trauma", label: { th: "Trauma", en: "Trauma" }, is_custom: false, sort_order: 11 },
  { key: "family", label: { th: "ครอบครัว", en: "Family" }, is_custom: false, sort_order: 12 },
  { key: "child_rearing", label: { th: "ปัญหาการเลี้ยงดูลูก", en: "Child Rearing" }, is_custom: false, sort_order: 13 },
  { key: "thinking", label: { th: "ปัญหาความคิด", en: "Thought patterns" }, is_custom: false, sort_order: 14 },
  { key: "personality", label: { th: "บุคลิกภาพ", en: "Personality" }, is_custom: false, sort_order: 15 },
  { key: "stress", label: { th: "ความเครียด", en: "Stress" }, is_custom: false, sort_order: 16 },
  { key: "depression", label: { th: "ซึมเศร้า", en: "Depression" }, is_custom: false, sort_order: 17 },
  { key: "work", label: { th: "การงาน", en: "Work" }, is_custom: false, sort_order: 18 },
];

export type PsychologistTopicRow = {
  slug: string;
  label_th: string;
  label_en: string;
  is_custom: boolean;
  sort_order: number;
  active: boolean;
};

export function toPsychologistTopicOptions(rows: PsychologistTopicRow[]) {
  return rows
    .filter((row) => row.active)
    .map((row) => ({
      key: row.slug,
      label: {
        th: row.label_th,
        en: row.label_en,
      },
      is_custom: row.is_custom,
      sort_order: row.sort_order,
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
}

export function mergePsychologistTopicOptions(rows: PsychologistTopicRow[]) {
  const loaded = toPsychologistTopicOptions(rows);
  const loadedByKey = new Map(loaded.map((option) => [option.key, option] as const));
  const defaultKeys = new Set(defaultPsychologistTopicOptions.map((option) => option.key));

  return [
    ...defaultPsychologistTopicOptions.map((option) => loadedByKey.get(option.key) ?? option),
    ...loaded.filter((option) => !defaultKeys.has(option.key)),
  ].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
}

export function getPsychologistTopicLabel(
  key: string,
  options: Array<{
    key: string;
    label: LocalizedText;
  }>,
  language: "th" | "en" = "th",
) {
  return options.find((option) => option.key === key)?.label[language] ?? key;
}

export const psychologistTopicOptions = defaultPsychologistTopicOptions;

export const psychologistTopicOptionsSeed: Array<{
  label: LocalizedText;
  key: PsychologistTopicKey;
  sort_order: number;
  is_custom: boolean;
}> = defaultPsychologistTopicOptions.map((option) => ({
  key: option.key,
  label: option.label,
  sort_order: option.sort_order,
  is_custom: option.is_custom,
}));

export type PsychologistRecord = {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  nickname_th: string;
  nickname_en: string;
  license_no: string;
  photo_url: string;
  approach_th: string;
  approach_en: string;
  value_th: string;
  value_en: string;
  quote_th: string;
  quote_en: string;
  topics: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PsychologistFormState = {
  id: string;
  slug: string;
  name_th: string;
  name_en: string;
  nickname_th: string;
  nickname_en: string;
  license_no: string;
  photo_url: string;
  approach_th: string;
  approach_en: string;
  value_th: string;
  value_en: string;
  quote_th: string;
  quote_en: string;
  topics: PsychologistTopicKey[];
  active: boolean;
  sort_order: number;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createUniqueTopicSlug(value: string, existingKeys: Iterable<string>) {
  const usedKeys = new Set(existingKeys);
  const base = slugify(value) || "topic";

  if (!usedKeys.has(base)) {
    return base;
  }

  let suffix = 2;
  while (usedKeys.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeLicenseNumber(value: string) {
  return value
    .replace(/^จค\.\s*/i, "")
    .replace(/[^0-9]/g, "")
    .trim();
}

export function formatLicenseNumber(value: string, language: "th" | "en" = "th") {
  const cleaned = normalizeLicenseNumber(value);
  if (!cleaned) return "";
  return language === "th" ? `จค. ${cleaned}` : `Lic. No. ${cleaned}`;
}

export function emptyPsychologistForm(sortOrder = 0): PsychologistFormState {
  return {
    id: "",
    slug: "",
    name_th: "",
    name_en: "",
    nickname_th: "",
    nickname_en: "",
    license_no: "",
    photo_url: "",
    approach_th: "",
    approach_en: "",
    value_th: "",
    value_en: "",
    quote_th: "",
    quote_en: "",
    topics: [],
    active: true,
    sort_order: sortOrder,
  };
}

export function psychologistToForm(
  row: PsychologistRecord,
  allowedTopics: Array<{ key: string }> = defaultPsychologistTopicOptions,
): PsychologistFormState {
  const allowedTopicKeys = new Set(allowedTopics.map((topic) => topic.key));

  return {
    id: row.id,
    slug: row.slug,
    name_th: row.name_th,
    name_en: row.name_en,
    nickname_th: row.nickname_th,
    nickname_en: row.nickname_en,
    license_no: normalizeLicenseNumber(row.license_no),
    photo_url: row.photo_url,
    approach_th: row.approach_th,
    approach_en: row.approach_en,
    value_th: row.value_th,
    value_en: row.value_en,
    quote_th: row.quote_th,
    quote_en: row.quote_en,
    topics: row.topics.filter((topic) => allowedTopicKeys.has(topic)),
    active: row.active,
    sort_order: row.sort_order,
  };
}

export function formatPsychologistName(row: PsychologistRecord) {
  return normalizeWhitespace(row.name_th) || normalizeWhitespace(row.name_en) || "Untitled";
}
