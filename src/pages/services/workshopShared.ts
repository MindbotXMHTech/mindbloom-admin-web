export type WorkshopCategoryRecord = {
  id: string;
  slug: string;
  title_th: string;
  title_en: string;
  subtitle_th: string;
  subtitle_en: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkshopProgramRecord = {
  id: string;
  category_id: string;
  slug: string;
  title_th: string;
  title_en: string;
  summary_th: string;
  summary_en: string;
  content_th: string;
  content_en: string;
  gallery_image_urls: string[];
  gallery_style: "square" | "landscape";
  show_cta: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function compareWorkshopProgramsByOrder(
  left: WorkshopProgramRecord,
  right: WorkshopProgramRecord,
) {
  const sortOrderDiff = left.sort_order - right.sort_order;

  if (sortOrderDiff !== 0) {
    return sortOrderDiff;
  }

  return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

export type WorkshopCategoryFormState = {
  id?: string;
  slug: string;
  title_th: string;
  title_en: string;
  sort_order: string;
  active: boolean;
};

export type WorkshopProgramFormState = {
  id?: string;
  category_id: string;
  slug: string;
  title_th: string;
  title_en: string;
  summary_th: string;
  summary_en: string;
  content_th: string;
  content_en: string;
  sort_order: string;
  gallery_style: "square" | "landscape";
  show_cta: boolean;
  active: boolean;
};

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function categoryToForm(category: WorkshopCategoryRecord): WorkshopCategoryFormState {
  return {
    id: category.id,
    slug: category.slug,
    title_th: category.title_th,
    title_en: category.title_en,
    sort_order: String(category.sort_order),
    active: category.active,
  };
}

export function programToForm(program: WorkshopProgramRecord): WorkshopProgramFormState {
  return {
    id: program.id,
    category_id: program.category_id,
    slug: program.slug,
    title_th: program.title_th,
    title_en: program.title_en,
    summary_th: program.summary_th,
    summary_en: program.summary_en,
    content_th: program.content_th,
    content_en: program.content_en,
    sort_order: String(program.sort_order),
    gallery_style: program.gallery_style,
    show_cta: program.show_cta,
    active: program.active,
  };
}

export function getWorkshopProgramAutoCtaIds(programs: WorkshopProgramRecord[]) {
  const ids = new Set<string>();
  const groupedPrograms = new Map<string, WorkshopProgramRecord[]>();

  programs.forEach((program) => {
    const existing = groupedPrograms.get(program.category_id) ?? [];
    existing.push(program);
    groupedPrograms.set(program.category_id, existing);
  });

  groupedPrograms.forEach((categoryPrograms) => {
    const activePrograms = categoryPrograms
      .filter((program) => program.active)
      .sort(compareWorkshopProgramsByOrder);
    const lastProgram = activePrograms.at(-1);

    if (lastProgram) {
      ids.add(lastProgram.id);
    }
  });

  return ids;
}

export function applyWorkshopProgramAutoCta(programs: WorkshopProgramRecord[]) {
  const autoCtaIds = getWorkshopProgramAutoCtaIds(programs);

  return programs.map((program) => ({
    ...program,
    show_cta: autoCtaIds.has(program.id),
  }));
}

export const emptyWorkshopCategoryForm = (sortOrder = 0): WorkshopCategoryFormState => ({
  slug: "",
  title_th: "",
  title_en: "",
  sort_order: String(sortOrder),
  active: true,
});

export const emptyWorkshopProgramForm = (
  categoryId = "",
  sortOrder = 0,
): WorkshopProgramFormState => ({
  category_id: categoryId,
  slug: "",
  title_th: "",
  title_en: "",
  summary_th: "",
  summary_en: "",
  content_th: "",
  content_en: "",
  sort_order: String(sortOrder),
  gallery_style: "landscape",
  show_cta: false,
  active: true,
});

function shortenText(value: string, maxLength = 140) {
  const compact = value.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trimEnd()}...`;
}

export function getWorkshopProgramPreviewText(
  summaryEn: string,
  summaryTh: string,
  contentEn: string,
  contentTh: string,
  language: "th" | "en" = "en",
  fallback = "No preview text yet.",
) {
  const source =
    language === "th"
      ? summaryTh || contentTh || summaryEn || contentEn
      : summaryEn || contentEn || summaryTh || contentTh;

  return shortenText(source || fallback);
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
