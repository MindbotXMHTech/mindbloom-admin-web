import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { LoadingBlock } from "../../components/ui/loading";
import {
  categoryToForm,
  emptyWorkshopCategoryForm,
  formatDateTime,
  normalizeInlineText,
  slugify,
  type WorkshopCategoryFormState,
  type WorkshopCategoryRecord,
} from "./workshopShared";

export default function WorkshopCategoryEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [categories, setCategories] = useState<WorkshopCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<WorkshopCategoryFormState>(() =>
    emptyWorkshopCategoryForm(),
  );
  const [deleteTarget, setDeleteTarget] = useState<WorkshopCategoryRecord | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<"th" | "en">("th");

  const loadCategories = async () => {
    const { data, error: queryError } = await supabase
      .from("workshop_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setCategories([]);
      setLoading(false);
      return;
    }

    setCategories((data ?? []) as WorkshopCategoryRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!saveNotice) return undefined;

    const timeout = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === id) ?? null,
    [categories, id],
  );

  useEffect(() => {
    if (!isNew && selectedCategory) {
      setForm(categoryToForm(selectedCategory));
      setActiveLanguage("th");
      return;
    }

    if (isNew) {
      const nextSortOrder =
        categories.length === 0
          ? 0
          : Math.max(...categories.map((category) => category.sort_order)) + 1;
      setForm(emptyWorkshopCategoryForm(nextSortOrder));
      setActiveLanguage("th");
    }
  }, [categories, isNew, selectedCategory]);

  const handleFieldChange = (
    field: keyof WorkshopCategoryFormState,
    value: string | boolean,
  ) => {
    setForm((current) => {
      const next = { ...current, [field]: value } as WorkshopCategoryFormState;

      if ((field === "title_en" || field === "title_th") && !current.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  };

  const previewTitle =
    activeLanguage === "th"
      ? normalizeInlineText(form.title_th) || normalizeInlineText(form.title_en) || "Untitled"
      : normalizeInlineText(form.title_en) || normalizeInlineText(form.title_th) || "Untitled";

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveNotice(null);

    const missingFields = [
      !form.title_th.trim() ? "Thai title" : "",
      !form.title_en.trim() ? "English title" : "",
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
      categories.length === 0
        ? 0
        : Math.max(...categories.map((category) => category.sort_order)) + 1;
    const nextSlug =
      form.slug.trim() ||
      slugify(form.title_en) ||
      slugify(form.title_th) ||
      `workshop-category-${Date.now()}`;

    const payload = {
      slug: nextSlug,
      title_th: normalizeInlineText(form.title_th),
      title_en: normalizeInlineText(form.title_en),
      subtitle_th: "",
      subtitle_en: "",
      sort_order: form.id ? Number(form.sort_order) || 0 : nextSortOrder,
      active: form.active,
    };

    const mutation = form.id
      ? supabase.from("workshop_categories").update(payload).eq("id", form.id)
      : supabase.from("workshop_categories").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setSaveNotice({ type: "error", message: saveError.message });
      setSaving(false);
      return;
    }

    await loadCategories();
    setSaving(false);
    setSaveNotice({ type: "success", message: "Workshop category saved successfully." });

    if (data) {
      const savedCategory = data as WorkshopCategoryRecord;
      setForm(categoryToForm(savedCategory));
      navigate(`/services/workshop-categories/edit/${savedCategory.id}`, { replace: true });
      return;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setSaveNotice(null);

    const { error: deleteError } = await supabase
      .from("workshop_categories")
      .delete()
      .eq("id", deleteTarget.id);

    if (deleteError) {
      setSaveNotice({ type: "error", message: deleteError.message });
      setSaving(false);
      return;
    }

    setDeleteTarget(null);
    await loadCategories();
    setSaving(false);
    navigate("/services/workshop-categories", { replace: true });
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

  const title = isNew ? "Create workshop category" : "Edit workshop category";

  return (
    <>
      <section className="grid content-start gap-4">
        <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-2">
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Services / {isNew ? "Create workshop category" : "Edit workshop category"}
                </div>
                <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
                  {title}
                </h1>
                <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
                  Manage the workshop category headings shown on the services and workshop pages.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                  to="/services/workshop-categories"
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                  Back to list
                </Link>
                {!isNew ? (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6c7c3] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                    onClick={() => setDeleteTarget(selectedCategory)}
                    disabled={saving || !selectedCategory}
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

        <section className="grid content-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] xl:items-start">
          <form
            onSubmit={handleSave}
            className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
          >
            <div className="flex flex-wrap gap-2">
              {(["th", "en"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => setActiveLanguage(language)}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    activeLanguage === language
                      ? "border-[#6f4f40] bg-[#6f4f40] text-white"
                      : "border-[#e3d4c6] bg-white text-[#7b6d5f] hover:bg-[#f7efe6] hover:text-[#2f2a24]",
                  ].join(" ")}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm text-[#7b6d5f]">
              Page link is generated automatically from category title.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Title (TH)</span>
                <input
                  type="text"
                  value={form.title_th}
                  onChange={(event) => handleFieldChange("title_th", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Title (EN)</span>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={(event) => handleFieldChange("title_en", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                />
              </label>
            </div>

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
                  Show this category on the public services and workshop pages.
                </span>
              </div>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                disabled={saving}
              >
                <Save size={16} strokeWidth={2} />
                {saving ? "Saving..." : "Save workshop category"}
              </button>
            </div>
          </form>

          <article className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Preview / {activeLanguage === "th" ? "Thai" : "English"}
                </div>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                  {previewTitle}
                </h3>
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

            <section className="grid gap-3 rounded-[22px] border border-[#e3d4c6] bg-white/80 p-4">
              <p className="text-sm leading-7 text-[#7b6d5f]">
                This title is used on both services and workshop pages.
              </p>
            </section>

            <p className="text-sm text-[#7b6d5f]">
              Slug: {form.slug || "-"}
              {selectedCategory ? ` · Last updated ${formatDateTime(selectedCategory.updated_at)}` : ""}
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
              {deleteTarget.title_en}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7b6d5f]">
              This will permanently delete the workshop category and its linked programs.
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
