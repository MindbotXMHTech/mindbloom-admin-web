export type ActivityStatus = "draft" | "published" | "archived";

export type ActivityRecord = {
  id: string;
  slug: string;
  title_th: string;
  title_en: string;
  summary_th: string | null;
  summary_en: string | null;
  content_th: string;
  content_en: string;
  cover_image_url: string;
  gallery_image_urls: string[];
  youtube_url: string | null;
  event_date: string | null;
  status: ActivityStatus;
  published_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ActivityFormState = {
  id?: string;
  slug: string;
  title_th: string;
  title_en: string;
  summary_th: string;
  summary_en: string;
  content_th: string;
  content_en: string;
  cover_image_url: string;
  gallery_image_urls_text: string;
  youtube_url: string;
  event_date: string;
  status: ActivityStatus;
  sort_order: string;
};

export function activityToForm(activity: ActivityRecord): ActivityFormState {
  return {
    id: activity.id,
    slug: activity.slug,
    title_th: activity.title_th,
    title_en: activity.title_en,
    summary_th: activity.summary_th ?? "",
    summary_en: activity.summary_en ?? "",
    content_th: activity.content_th,
    content_en: activity.content_en,
    cover_image_url: activity.cover_image_url,
    gallery_image_urls_text: activity.gallery_image_urls.join("\n"),
    youtube_url: activity.youtube_url ?? "",
    event_date: activity.event_date ?? "",
    status: activity.status,
    sort_order: String(activity.sort_order),
  };
}

export const emptyActivityForm = (sortOrder = 0): ActivityFormState => ({
  slug: "",
  title_th: "",
  title_en: "",
  summary_th: "",
  summary_en: "",
  content_th: "",
  content_en: "",
  cover_image_url: "",
  gallery_image_urls_text: "",
  youtube_url: "",
  event_date: "",
  status: "draft",
  sort_order: String(sortOrder),
});

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatEventDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function statusLabel(status: ActivityStatus) {
  switch (status) {
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

export function statusClass(status: ActivityStatus) {
  switch (status) {
    case "published":
      return "badge success";
    case "archived":
      return "badge neutral";
    default:
      return "badge warning";
  }
}

export function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseImageUrls(value: string) {
  const seen = new Set<string>();

  return value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });
}

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

export function getActivityPreviewText(
  summaryEn: string | null,
  summaryTh: string | null,
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
