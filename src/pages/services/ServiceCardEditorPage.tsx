import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImageUp, Save, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { LoadingBlock } from "../../components/ui/loading";
import consult1Icon from "../../assets/svgs/consult1.svg";
import consult2Icon from "../../assets/svgs/consult2.svg";
import consult3Icon from "../../assets/svgs/consult3.svg";
import {
  durationLinesForPreview,
  durationLinesToStoredValue,
  emptyServiceCardForm,
  formatDateTime,
  getServiceCardDefaults,
  normalizeInlineText,
  normalizeMultilineText,
  parseLineList,
  priceFieldsToPreviewLines,
  priceFieldsToStoredLines,
  serviceCardIconOptions,
  serviceCardToForm,
  slugify,
  type ServiceCardFormState,
  type ServiceCardRecord,
} from "./serviceCardShared";

const CONTENT_IMAGE_BUCKET = "content-images";

function getStorageObjectPath(url: string) {
  if (!url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${CONTENT_IMAGE_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export default function ServiceCardEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [cards, setCards] = useState<ServiceCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<ServiceCardFormState>(() => emptyServiceCardForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCardRecord | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<"th" | "en">("th");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState("");

  const loadCards = async () => {
    const { data, error: queryError } = await supabase
      .from("service_cards")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setCards([]);
      setLoading(false);
      return;
    }

    setCards((data ?? []) as ServiceCardRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadCards();
  }, []);

  useEffect(() => {
    if (!saveNotice) return undefined;

    const timeout = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === id) ?? null,
    [cards, id],
  );

  useEffect(() => {
    if (!isNew && selectedCard) {
      setForm(serviceCardToForm(selectedCard));
      setSlugTouched(true);
      setActiveLanguage("th");
      setIconFile(null);
      return;
    }

    if (isNew) {
      const nextSortOrder =
        cards.length === 0 ? 0 : Math.max(...cards.map((card) => card.sort_order)) + 1;
      setForm(emptyServiceCardForm(nextSortOrder));
      setSlugTouched(false);
      setActiveLanguage("th");
      setIconFile(null);
    }
  }, [cards, isNew, selectedCard]);

  useEffect(() => {
    if (iconFile) {
      const localPreviewUrl = URL.createObjectURL(iconFile);
      setIconPreviewUrl(localPreviewUrl);
      return () => URL.revokeObjectURL(localPreviewUrl);
    }

    setIconPreviewUrl(form.icon_image_url.trim());
    return undefined;
  }, [form.icon_image_url, iconFile]);

  const handleFieldChange = (field: keyof ServiceCardFormState, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [field]: value } as ServiceCardFormState;

      if (field === "icon_key" && typeof value === "string") {
        const previousDefaults = getServiceCardDefaults(current.icon_key);
        const nextDefaults = getServiceCardDefaults(value);
        const defaultBackedFields: Array<keyof ServiceCardFormState> = [
          "info_heading_th",
          "info_heading_en",
          "info_lines_th",
          "info_lines_en",
        ];

        defaultBackedFields.forEach((defaultField) => {
          const currentValue = String(current[defaultField] ?? "");
          const previousDefault = previousDefaults[defaultField as keyof typeof previousDefaults];

          if (!currentValue.trim() || currentValue === previousDefault) {
            (next as Record<string, string | boolean | undefined>)[defaultField] =
              nextDefaults[defaultField as keyof typeof nextDefaults];
          }
        });
      }

      if (!slugTouched && (field === "title_primary_en" || field === "title_primary_th") && !current.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  };

  const previewDefaults = getServiceCardDefaults(form.icon_key);

  const previewTitle =
    activeLanguage === "th"
      ? normalizeInlineText(form.title_primary_th) || normalizeInlineText(form.title_primary_en) || "Untitled"
      : normalizeInlineText(form.title_primary_en) || normalizeInlineText(form.title_primary_th) || "Untitled";
  const previewSecondary =
    activeLanguage === "th"
      ? normalizeInlineText(form.title_secondary_th) || normalizeInlineText(form.title_secondary_en)
      : normalizeInlineText(form.title_secondary_en) || normalizeInlineText(form.title_secondary_th);
  const previewDetails =
    activeLanguage === "th"
      ? parseLineList(form.details_th)
      : parseLineList(form.details_en);
  const previewInfoHeading =
    activeLanguage === "th"
      ? normalizeInlineText(form.info_heading_th) ||
        normalizeInlineText(form.info_heading_en) ||
        previewDefaults.info_heading_th
      : normalizeInlineText(form.info_heading_en) ||
        normalizeInlineText(form.info_heading_th) ||
        previewDefaults.info_heading_en;
  const previewInfoLines =
    activeLanguage === "th"
      ? parseLineList(form.info_lines_th || previewDefaults.info_lines_th)
      : parseLineList(form.info_lines_en || previewDefaults.info_lines_en);
  const previewNoteLines =
    activeLanguage === "th" ? parseLineList(form.note_lines_th) : parseLineList(form.note_lines_en);
  const previewDuration =
    activeLanguage === "th"
      ? durationLinesForPreview(form.duration_th, "th")
      : durationLinesForPreview(form.duration_en, "en");
  const previewExtra =
    activeLanguage === "th"
      ? normalizeInlineText(form.extra_th) || normalizeInlineText(form.extra_en)
      : normalizeInlineText(form.extra_en) || normalizeInlineText(form.extra_th);
  const previewIconMap: Record<string, string> = {
    consult1: consult1Icon,
    consult2: consult2Icon,
    consult3: consult3Icon,
  };
  const previewIconSrc = iconPreviewUrl || previewIconMap[form.icon_key] || "";
  const previewDetailsLabel = activeLanguage === "th" ? "รายละเอียด" : "Details";
  const previewInfoLabel = previewInfoHeading || (activeLanguage === "th" ? "ข้อมูล" : "Info");
  const previewCtaLabel =
    activeLanguage === "th" ? "นัดหมาย/สอบถามข้อมูลเพิ่มเติม" : "Book / Contact for details";
  const previewCurrencyLabel = activeLanguage === "th" ? "บาท" : "THB";
  const previewPriceLines = priceFieldsToPreviewLines(form.price_from, form.price_to);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveNotice(null);

    const missingFields = [
      !form.title_primary_th.trim() ? "Thai primary title" : "",
      !form.title_primary_en.trim() ? "English primary title" : "",
      !form.details_th.trim() ? "Thai details" : "",
      !form.details_en.trim() ? "English details" : "",
      !form.price_from.trim() ? "price" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setSaveNotice({
        type: "error",
        message: `Please fill in: ${missingFields.join(", ")}.`,
      });
      setSaving(false);
      return;
    }

    const nextSortOrder =
      cards.length === 0 ? 0 : Math.max(...cards.map((card) => card.sort_order)) + 1;
    const nextSlug =
      form.slug.trim() ||
      slugify(form.title_primary_en) ||
      slugify(form.title_primary_th) ||
      `service-card-${Date.now()}`;
    let iconImageUrl = form.icon_image_url.trim();

    if (iconFile) {
      const ext = iconFile.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `service-cards/${nextSlug}/icon-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(CONTENT_IMAGE_BUCKET)
        .upload(filePath, iconFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: iconFile.type || undefined,
        });

      if (uploadError) {
        setSaveNotice({ type: "error", message: uploadError.message });
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from(CONTENT_IMAGE_BUCKET)
        .getPublicUrl(filePath);
      iconImageUrl = publicUrlData.publicUrl;
    }

    const payload = {
      slug: nextSlug,
      icon_key: form.icon_key,
      icon_image_url: iconImageUrl,
      title_primary_th: normalizeInlineText(form.title_primary_th),
      title_primary_en: normalizeInlineText(form.title_primary_en),
      title_secondary_th: normalizeInlineText(form.title_secondary_th),
      title_secondary_en: normalizeInlineText(form.title_secondary_en),
      details_th: normalizeMultilineText(form.details_th),
      details_en: normalizeMultilineText(form.details_en),
      info_heading_th: normalizeInlineText(form.info_heading_th) || previewDefaults.info_heading_th,
      info_heading_en: normalizeInlineText(form.info_heading_en) || previewDefaults.info_heading_en,
      info_lines_th: normalizeMultilineText(form.info_lines_th) || previewDefaults.info_lines_th,
      info_lines_en: normalizeMultilineText(form.info_lines_en) || previewDefaults.info_lines_en,
      note_lines_th: normalizeMultilineText(form.note_lines_th),
      note_lines_en: normalizeMultilineText(form.note_lines_en),
      duration_th: durationLinesToStoredValue(form.duration_th, "th"),
      duration_en: durationLinesToStoredValue(form.duration_en, "en"),
      price_lines: priceFieldsToStoredLines(form.price_from, form.price_to),
      extra_th: normalizeInlineText(form.extra_th),
      extra_en: normalizeInlineText(form.extra_en),
      sort_order: form.id ? Number(form.sort_order) || 0 : nextSortOrder,
      active: form.active,
    };

    const mutation = form.id
      ? supabase.from("service_cards").update(payload).eq("id", form.id)
      : supabase.from("service_cards").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setSaveNotice({ type: "error", message: saveError.message });
      setSaving(false);
      return;
    }

    await loadCards();
    setSaving(false);
    setSaveNotice({ type: "success", message: "Service card saved successfully." });

    if (data) {
      const savedCard = data as ServiceCardRecord;
      setForm(serviceCardToForm(savedCard));
      setSlugTouched(true);
      setIconFile(null);
      navigate(`/services/cards/edit/${savedCard.id}`, { replace: true });
      return;
    }

    if (!form.id) {
      setForm(emptyServiceCardForm(Number(form.sort_order) + 1));
      setSlugTouched(false);
      setIconFile(null);
      navigate("/services/cards/create", { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setSaveNotice(null);

    const iconObjectPath = getStorageObjectPath(deleteTarget.icon_image_url);

    if (iconObjectPath) {
      const { error: storageError } = await supabase.storage
        .from(CONTENT_IMAGE_BUCKET)
        .remove([iconObjectPath]);

      if (storageError) {
        setSaveNotice({ type: "error", message: storageError.message });
        setSaving(false);
        return;
      }
    }

    const { error: deleteError } = await supabase.from("service_cards").delete().eq("id", deleteTarget.id);

    if (deleteError) {
      setSaveNotice({ type: "error", message: deleteError.message });
      setSaving(false);
      return;
    }

    setDeleteTarget(null);
    await loadCards();
    setSaving(false);
    navigate("/services/cards", { replace: true });
  };

  if (!isNew && loading) {
    return (
      <section className="grid content-start gap-4">
        <section className="grid self-start gap-3 rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <LoadingBlock className="h-4 w-32 rounded-full" />
          <LoadingBlock className="h-10 w-52 rounded-full" />
          <LoadingBlock className="h-4 w-full max-w-2xl rounded-full" />
        </section>
      </section>
    );
  }

  const title = isNew ? "Create service card" : "Edit service card";

  return (
    <>
      <section className="grid content-start gap-4">
        <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-2">
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Services / {isNew ? "Create service card" : "Edit service card"}
                </div>
                <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
                  {title}
                </h1>
                <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
                  Manage the long-format service cards shown on the public services page.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                  to="/services/cards"
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                  Back to list
                </Link>
                {!isNew ? (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6c7c3] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                    onClick={() => setDeleteTarget(selectedCard)}
                    disabled={saving || !selectedCard}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                    Delete
                  </button>
                ) : null}
              </div>
          </div>
        </section>

        {saveNotice ? (
          <p
            className={[
              "rounded-2xl border px-4 py-3 text-sm shadow-[0_14px_36px_rgba(65,43,27,0.06)]",
              saveNotice.type === "success"
                ? "border-[#b9d7b1] bg-[rgba(237,247,233,0.95)] text-[#35613a]"
                : "border-[#e3b6af] bg-[rgba(255,238,235,0.95)] text-[#8e3a32]",
            ].join(" ")}
          >
            {saveNotice.message}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {error}
          </p>
        ) : null}

        <section className="grid content-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
          <form
            onSubmit={handleSave}
            className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Default preset</span>
                <select
                  value={form.icon_key}
                  onChange={(event) => handleFieldChange("icon_key", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
                >
                  {serviceCardIconOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Service icon</span>
                <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d9c6b6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:border-[#c7ae98] hover:text-[#2f2a24]">
                  <ImageUp size={16} strokeWidth={2} />
                  <span>{iconFile ? iconFile.name : form.icon_image_url ? "Replace uploaded icon" : "Upload icon"}</span>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setIconFile(file);
                    }}
                  />
                </label>
              </label>
            </div>

            {iconFile || form.icon_image_url ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3">
                <div className="text-sm text-[#7b6d5f]">
                  {iconFile ? "New icon ready to upload on save." : "Using uploaded icon."}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#a94135]"
                  onClick={() => {
                    setIconFile(null);
                    handleFieldChange("icon_image_url", "");
                  }}
                >
                  <X size={14} strokeWidth={2} />
                  Remove uploaded icon
                </button>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Primary title (TH)</span>
                <input
                  type="text"
                  value={form.title_primary_th}
                  onChange={(event) => handleFieldChange("title_primary_th", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Primary title (EN)</span>
                <input
                  type="text"
                  value={form.title_primary_en}
                  onChange={(event) => handleFieldChange("title_primary_en", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Secondary title (TH)</span>
                <input
                  type="text"
                  value={form.title_secondary_th}
                  onChange={(event) => handleFieldChange("title_secondary_th", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Secondary title (EN)</span>
                <input
                  type="text"
                  value={form.title_secondary_en}
                  onChange={(event) => handleFieldChange("title_secondary_en", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Details (TH)</span>
                <textarea
                  rows={6}
                  value={form.details_th}
                  onChange={(event) => handleFieldChange("details_th", event.target.value)}
                  placeholder="One line per paragraph"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Details (EN)</span>
                <textarea
                  rows={6}
                  value={form.details_en}
                  onChange={(event) => handleFieldChange("details_en", event.target.value)}
                  placeholder="One line per paragraph"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Info lines (TH)</span>
                <textarea
                  rows={4}
                  value={form.info_lines_th}
                  onChange={(event) => handleFieldChange("info_lines_th", event.target.value)}
                  placeholder="One line per item"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Info lines (EN)</span>
                <textarea
                  rows={4}
                  value={form.info_lines_en}
                  onChange={(event) => handleFieldChange("info_lines_en", event.target.value)}
                  placeholder="One line per item"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Note lines (TH)</span>
                <textarea
                  rows={4}
                  value={form.note_lines_th}
                  onChange={(event) => handleFieldChange("note_lines_th", event.target.value)}
                  placeholder="One line per item"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Note lines (EN)</span>
                <textarea
                  rows={4}
                  value={form.note_lines_en}
                  onChange={(event) => handleFieldChange("note_lines_en", event.target.value)}
                  placeholder="One line per item"
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Duration (TH)</span>
                <input
                  type="text"
                  value={form.duration_th}
                  onChange={(event) => handleFieldChange("duration_th", event.target.value)}
                  placeholder="60 or 60-120"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Duration (EN)</span>
                <input
                  type="text"
                  value={form.duration_en}
                  onChange={(event) => handleFieldChange("duration_en", event.target.value)}
                  placeholder="60 or 60-120"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Price</span>
                <input
                  type="text"
                  value={form.price_from}
                  onChange={(event) => handleFieldChange("price_from", event.target.value)}
                  placeholder="2,000"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Range end (optional)</span>
                <input
                  type="text"
                  value={form.price_to}
                  onChange={(event) => handleFieldChange("price_to", event.target.value)}
                  placeholder="4,550"
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Extra note (TH)</span>
                <input
                  type="text"
                  value={form.extra_th}
                  onChange={(event) => handleFieldChange("extra_th", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Extra note (EN)</span>
                <input
                  type="text"
                  value={form.extra_en}
                  onChange={(event) => handleFieldChange("extra_en", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => handleFieldChange("active", event.target.checked)}
                  className="h-4 w-4 accent-[#6f4f40]"
                />
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-[#2f2a24]">Active</span>
                  <span className="text-xs text-[#7b6d5f]">
                    Show this service card on the public site.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                disabled={saving}
              >
                <Save size={16} strokeWidth={2} />
                {saving ? "Saving..." : "Save service card"}
              </button>
            </div>
          </form>

          <article className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Live preview
                </div>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                  {previewTitle}
                </h3>
                {previewSecondary ? (
                  <p className="mt-1 text-sm text-[#55748f]">{previewSecondary}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex rounded-full border border-[#e3d4c6] bg-white p-1 text-sm">
                  {(["th", "en"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => setActiveLanguage(language)}
                      className={[
                        "rounded-full px-3 py-1.5 transition-colors",
                        activeLanguage === language
                          ? "bg-[#6f4f40] text-white"
                          : "text-[#7b6d5f] hover:bg-[#f7efe6]",
                      ].join(" ")}
                    >
                      {language.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span
                  className={[
                    "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                    form.active
                      ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                      : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                  ].join(" ")}
                >
                  {form.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <section className="flex w-full max-w-[350px] flex-col rounded-[28px] border border-[#ebdfd5] bg-white p-6">
                <div className="flex justify-center">
                  {previewIconSrc ? (
                    <img src={previewIconSrc} alt="" className="h-32 w-auto" />
                  ) : (
                    <div className="grid h-32 w-32 place-items-center rounded-3xl bg-[#f6efe6] text-sm text-[#7b6d5f]">
                      Icon
                    </div>
                  )}
                </div>

                <h3 className="mt-6 min-h-[72px] text-center text-[20px] font-semibold leading-tight text-[#55748f]">
                  {previewTitle}
                  <br />
                  <span className="text-[16px] font-semibold leading-tight text-[#55748f]">
                    {previewSecondary || "-"}
                  </span>
                </h3>

                <p className="mt-6 text-center text-[16px] font-bold text-[#7b6d5f]">
                  {previewDetailsLabel}
                </p>
                <div className="mt-4 min-h-[128px] text-center text-sm leading-7 text-[#7b6d5f]">
                  {previewDetails.length > 0 ? (
                    previewDetails.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>-</p>
                  )}
                </div>

                <p className="mt-6 text-center text-[16px] font-bold text-[#7b6d5f]">
                  {previewInfoLabel}
                </p>
                <div className="mt-4 min-h-[92px] text-center text-sm leading-7 text-[#7b6d5f]">
                  {previewInfoLines.length > 0 ? (
                    previewInfoLines.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>-</p>
                  )}
                </div>

                <div className="mt-6 min-h-[64px] text-center text-sm leading-7 text-[#7b6d5f]">
                  {previewNoteLines.length > 0 ? (
                    previewNoteLines.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>&nbsp;</p>
                  )}
                </div>

                <div className="relative mt-6 h-28 w-full text-[#e5aba4]">
                  <div className="absolute top-0 left-4 max-w-[132px]">
                    {previewDuration.length > 0 ? (
                      previewDuration.map((line) => (
                        <p key={line} className="text-[32px] font-bold leading-tight break-words">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-[32px] font-bold leading-tight">-</p>
                    )}
                  </div>
                  <div className="absolute inset-0 m-auto h-[2px] w-[108px] rotate-[-47deg] bg-[#edc4bf]" />
                  <div className="absolute right-4 bottom-0 flex flex-col items-end">
                    {previewPriceLines.length > 0 ? (
                      previewPriceLines.map((line) => (
                        <p key={line} className="whitespace-nowrap text-[28px] leading-none">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-[28px] leading-none">-</p>
                    )}
                    <p className="text-base leading-none">{previewCurrencyLabel}</p>
                  </div>
                </div>

                <p className="mt-4 min-h-[44px] text-center text-[14px] font-semibold text-[#e2a39d]">
                  {previewExtra || "\u00A0"}
                </p>

                <div className="mt-auto flex justify-center pt-3">
                  <div className="rounded-full border border-[#6c8aa4] px-5 py-2 text-[16px] font-semibold text-[#6c8aa4]">
                    {previewCtaLabel}
                  </div>
                </div>
              </section>
            </div>

            <p className="text-sm text-[#7b6d5f]">
              {selectedCard ? `Last updated ${formatDateTime(selectedCard.updated_at)}` : "New service card"}
            </p>
          </article>
        </section>
      </section>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(37,27,19,0.36)] p-5 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.96)] p-6 shadow-[0_20px_50px_rgba(65,43,27,0.18)]">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Confirm delete
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {deleteTarget.title_primary_en}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7b6d5f]">
              This will permanently delete the service card from Supabase.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#a941352e] bg-[#a94135] px-4 text-sm font-medium text-white transition-colors hover:bg-[#8f382d]"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
