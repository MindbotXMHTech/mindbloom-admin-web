import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, ImageUp, Save, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { LoadingBlock } from "../../components/ui/loading";
import {
  emptyWorkshopProgramForm,
  formatDateTime,
  getWorkshopProgramAutoCtaIds,
  normalizeInlineText,
  programToForm,
  slugify,
  type WorkshopCategoryRecord,
  type WorkshopProgramFormState,
  type WorkshopProgramRecord,
} from "./workshopShared";

type GalleryItem =
  | {
      id: string;
      kind: "existing";
      url: string;
      label: string;
    }
  | {
      id: string;
      kind: "upload";
      file: File;
      previewUrl: string;
      label: string;
    };

const WORKSHOP_PROGRAM_STORAGE_BUCKET = "content-images";

function createExistingGalleryItems(urls: string[]): GalleryItem[] {
  return urls.map((url, index) => ({
    id: `existing-${index}-${url}`,
    kind: "existing",
    url,
    label: url.split("/").pop() || `image-${index + 1}`,
  }));
}

function getStorageObjectPath(url: string) {
  if (!url.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${WORKSHOP_PROGRAM_STORAGE_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export default function WorkshopProgramEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [categories, setCategories] = useState<WorkshopCategoryRecord[]>([]);
  const [programs, setPrograms] = useState<WorkshopProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<WorkshopProgramFormState>(() =>
    emptyWorkshopProgramForm(),
  );
  const [deleteTarget, setDeleteTarget] = useState<WorkshopProgramRecord | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [draggedGalleryId, setDraggedGalleryId] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<"th" | "en">("th");
  const uploadPreviewUrlsRef = useRef<string[]>([]);

  const clearUploadPreviews = () => {
    uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadPreviewUrlsRef.current = [];
  };

  const removeTrackedPreview = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    uploadPreviewUrlsRef.current = uploadPreviewUrlsRef.current.filter((url) => url !== previewUrl);
  };

  useEffect(() => () => clearUploadPreviews(), []);

  const loadData = async () => {
    const [{ data: categoryData, error: categoryError }, { data: programData, error: programError }] =
      await Promise.all([
        supabase
          .from("workshop_categories")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("workshop_programs")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

    if (categoryError) {
      setError(categoryError.message);
      setCategories([]);
      setPrograms([]);
      setLoading(false);
      return;
    }

    if (programError) {
      setError(programError.message);
      setCategories((categoryData ?? []) as WorkshopCategoryRecord[]);
      setPrograms([]);
      setLoading(false);
      return;
    }

    setCategories((categoryData ?? []) as WorkshopCategoryRecord[]);
    setPrograms((programData ?? []) as WorkshopProgramRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!saveNotice) return undefined;

    const timeout = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === id) ?? null,
    [programs, id],
  );

  useEffect(() => {
    if (!isNew && selectedProgram) {
      setForm(programToForm(selectedProgram));
      clearUploadPreviews();
      setGalleryItems(createExistingGalleryItems(selectedProgram.gallery_image_urls));
      setDraggedGalleryId(null);
      setActiveLanguage("th");
      return;
    }

    if (isNew && categories.length > 0) {
      const targetCategoryId = form.category_id || categories[0].id;
      const nextSortOrder = programs.filter((program) => program.category_id === targetCategoryId).length;

      setForm(emptyWorkshopProgramForm(targetCategoryId, nextSortOrder));
      clearUploadPreviews();
      setGalleryItems([]);
      setDraggedGalleryId(null);
      setActiveLanguage("th");
    }
  }, [categories, isNew, programs, selectedProgram]);

  const handleFieldChange = (
    field: keyof WorkshopProgramFormState,
    value: string | boolean,
  ) => {
    setForm((current) => {
      const next = { ...current, [field]: value } as WorkshopProgramFormState;

      if (field === "category_id") {
        const nextCategoryId = String(value);
        next.sort_order = String(
          programs.filter((program) => program.category_id === nextCategoryId && program.id !== current.id)
            .length,
        );
      }

      if ((field === "title_en" || field === "title_th") && !current.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  };

  const moveGalleryItemById = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setGalleryItems((current) => {
      const fromIndex = current.findIndex((item) => item.id === fromId);
      const toIndex = current.findIndex((item) => item.id === toId);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const removeGalleryItem = (index: number) => {
    setGalleryItems((current) => {
      const target = current[index];

      if (target?.kind === "upload") {
        removeTrackedPreview(target.previewUrl);
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const appendGalleryFiles = (files: File[]) => {
    if (files.length === 0) return;

    const nextItems = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      uploadPreviewUrlsRef.current.push(previewUrl);

      return {
        id: `${crypto.randomUUID()}-${index}`,
        kind: "upload" as const,
        file,
        previewUrl,
        label: file.name,
      };
    });

    setGalleryItems((current) => [...current, ...nextItems]);
  };

  const previewTitle =
    normalizeInlineText(form.title_th) || normalizeInlineText(form.title_en) || "Untitled";
  const previewSummary =
    activeLanguage === "th"
      ? normalizeInlineText(form.summary_th) || normalizeInlineText(form.summary_en)
      : normalizeInlineText(form.summary_en) || normalizeInlineText(form.summary_th);
  const previewContent =
    activeLanguage === "th"
      ? form.content_th.trim() || form.content_en.trim()
      : form.content_en.trim() || form.content_th.trim();

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveNotice(null);

    const missingFields = [
      !form.category_id ? "category" : "",
      !normalizeInlineText(form.title_th || form.title_en) ? "title" : "",
      !form.content_th.trim() ? "Thai content" : "",
      !form.content_en.trim() ? "English content" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setSaveNotice({
        type: "error",
        message: `Please fill in: ${missingFields.join(", ")}.`,
      });
      setSaving(false);
      return;
    }

    const sharedTitle = normalizeInlineText(form.title_th || form.title_en);
    const nextSlug = form.slug.trim() || slugify(sharedTitle) || `workshop-program-${Date.now()}`;
    const nextSortOrder = form.id
      ? Number(form.sort_order) || 0
      : programs.filter((program) => program.category_id === form.category_id).length;
    const currentProgramId = form.id ?? crypto.randomUUID();
    const previousProgram = selectedProgram ?? null;
    const nextProgramSnapshot: WorkshopProgramRecord = {
      id: currentProgramId,
      category_id: form.category_id,
      slug: nextSlug,
      title_th: sharedTitle,
      title_en: sharedTitle,
      summary_th: normalizeInlineText(form.summary_th),
      summary_en: normalizeInlineText(form.summary_en),
      content_th: form.content_th.trim(),
      content_en: form.content_en.trim(),
      gallery_image_urls: [],
      gallery_style: form.gallery_style,
      show_cta: false,
      sort_order: nextSortOrder,
      active: form.active,
      created_at: previousProgram?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const nextPrograms = [
      ...programs.filter((program) => program.id !== currentProgramId),
      nextProgramSnapshot,
    ];
    const autoCtaIds = getWorkshopProgramAutoCtaIds(nextPrograms);
    const galleryImageUrls: string[] = [];

    try {
      const safeSlug = nextSlug;

      for (let index = 0; index < galleryItems.length; index += 1) {
        const item = galleryItems[index];

        if (item.kind === "existing") {
          galleryImageUrls.push(item.url);
          continue;
        }

        const ext = item.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `workshop-programs/${safeSlug}/gallery-${Date.now()}-${index}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(WORKSHOP_PROGRAM_STORAGE_BUCKET)
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: true,
            contentType: item.file.type || undefined,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from(WORKSHOP_PROGRAM_STORAGE_BUCKET)
          .getPublicUrl(filePath);

        galleryImageUrls.push(publicUrlData.publicUrl);
      }
    } catch (uploadError) {
      setSaveNotice({
        type: "error",
        message:
          uploadError instanceof Error
            ? uploadError.message
            : "Unable to upload gallery images.",
      });
      setSaving(false);
      return;
    }

    const payload = {
      category_id: form.category_id,
      slug: nextSlug,
      title_th: sharedTitle,
      title_en: sharedTitle,
      summary_th: normalizeInlineText(form.summary_th),
      summary_en: normalizeInlineText(form.summary_en),
      content_th: form.content_th.trim(),
      content_en: form.content_en.trim(),
      gallery_image_urls: galleryImageUrls,
      gallery_style: form.gallery_style,
      show_cta: autoCtaIds.has(currentProgramId),
      sort_order: nextSortOrder,
      active: form.active,
    };

    const mutation = form.id
      ? supabase.from("workshop_programs").update(payload).eq("id", form.id)
      : supabase.from("workshop_programs").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setSaveNotice({ type: "error", message: saveError.message });
      setSaving(false);
      return;
    }

    await loadData();
    setSaving(false);
    setSaveNotice({ type: "success", message: "Workshop program saved successfully." });

    if (data) {
      const savedProgram = data as WorkshopProgramRecord;
      setForm(programToForm(savedProgram));
      clearUploadPreviews();
      setGalleryItems(createExistingGalleryItems(savedProgram.gallery_image_urls));

      const nextProgramsAfterSave = [
        ...programs.filter((program) => program.id !== savedProgram.id),
        savedProgram,
      ];
      const affectedCategoryIds = new Set<string>([
        previousProgram?.category_id,
        savedProgram.category_id,
      ].filter((value): value is string => Boolean(value)));

      await Promise.all(
        [...affectedCategoryIds].map(async (categoryId) => {
          const categoryAutoCtaIds = getWorkshopProgramAutoCtaIds(
            nextProgramsAfterSave.filter((program) => program.category_id === categoryId),
          );

          await Promise.all(
            nextProgramsAfterSave
              .filter((program) => program.category_id === categoryId)
              .map((program) =>
                supabase
                  .from("workshop_programs")
                  .update({ show_cta: categoryAutoCtaIds.has(program.id) })
                  .eq("id", program.id),
              ),
          );
        }),
      );

      navigate(`/services/workshop-programs/edit/${savedProgram.id}`, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setSaveNotice(null);

    const storageObjectPaths = new Set<string>();
    const storageFolder = `workshop-programs/${deleteTarget.slug}`;

    deleteTarget.gallery_image_urls.forEach((url) => {
      const objectPath = getStorageObjectPath(url);
      if (objectPath) {
        storageObjectPaths.add(objectPath);
      }
    });

    const { data: folderItems, error: listError } = await supabase.storage
      .from(WORKSHOP_PROGRAM_STORAGE_BUCKET)
      .list(storageFolder, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      setSaveNotice({ type: "error", message: listError.message });
      setSaving(false);
      return;
    }

    folderItems?.forEach((item) => {
      if (item.name) {
        storageObjectPaths.add(`${storageFolder}/${item.name}`);
      }
    });

    if (storageObjectPaths.size > 0) {
      const { error: storageError } = await supabase.storage
        .from(WORKSHOP_PROGRAM_STORAGE_BUCKET)
        .remove([...storageObjectPaths]);

      if (storageError) {
        setSaveNotice({ type: "error", message: storageError.message });
        setSaving(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("workshop_programs")
      .delete()
      .eq("id", deleteTarget.id);

    if (deleteError) {
      setSaveNotice({ type: "error", message: deleteError.message });
      setSaving(false);
      return;
    }

    const remainingPrograms = programs.filter((program) => program.id !== deleteTarget.id);
    const remainingCategoryPrograms = remainingPrograms.filter(
      (program) => program.category_id === deleteTarget.category_id,
    );
    const autoCtaIds = getWorkshopProgramAutoCtaIds(remainingCategoryPrograms);

    await Promise.all(
      remainingCategoryPrograms.map((program) =>
        supabase.from("workshop_programs").update({ show_cta: autoCtaIds.has(program.id) }).eq("id", program.id),
      ),
    );

    setDeleteTarget(null);
    await loadData();
    setSaving(false);
    navigate("/services/workshop-programs", { replace: true });
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

  const title = isNew ? "Create workshop program" : "Edit workshop program";

  return (
    <>
      <section className="grid content-start gap-4">
        <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-2">
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Services / {isNew ? "Create workshop program" : "Edit workshop program"}
                </div>
                <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
                  {title}
                </h1>
                <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
                  Manage one workshop program section with shared title and bilingual content.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                  to="/services/workshop-programs"
                >
                  <ArrowLeft size={16} strokeWidth={2} />
                  Back to list
                </Link>
                {!isNew ? (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6c7c3] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                    onClick={() => setDeleteTarget(selectedProgram)}
                    disabled={saving || !selectedProgram}
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

        <section className="grid content-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] xl:items-start">
          <form
            onSubmit={handleSave}
            className="grid self-start gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Category</span>
                <select
                  value={form.category_id}
                  onChange={(event) => handleFieldChange("category_id", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.title_en}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium text-[#7b6d5f]">Title</span>
              <input
                type="text"
                value={form.title_th || form.title_en}
                onChange={(event) => {
                  const value = event.target.value;
                  handleFieldChange("title_th", value);
                  handleFieldChange("title_en", value);
                }}
                placeholder="Psychological First Aid"
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
              />
              <p className="text-xs text-[#7b6d5f]">This title is shared across Thai and English.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Summary (TH)</span>
                <textarea
                  rows={4}
                  value={form.summary_th}
                  onChange={(event) => handleFieldChange("summary_th", event.target.value)}
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Summary (EN)</span>
                <textarea
                  rows={4}
                  value={form.summary_en}
                  onChange={(event) => handleFieldChange("summary_en", event.target.value)}
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Content (TH)</span>
                <textarea
                  rows={8}
                  value={form.content_th}
                  onChange={(event) => handleFieldChange("content_th", event.target.value)}
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Content (EN)</span>
                <textarea
                  rows={8}
                  value={form.content_en}
                  onChange={(event) => handleFieldChange("content_en", event.target.value)}
                  className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => handleFieldChange("active", event.target.checked)}
                  className="h-4 w-4 accent-[#6f4f40]"
                />
                <div className="grid gap-1">
                  <span className="text-sm font-medium text-[#2f2a24]">Active</span>
                  <span className="text-xs text-[#7b6d5f]">Show this program on the public workshop page.</span>
                </div>
              </label>
            </div>

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Gallery images</span>
              <div className="grid gap-3 rounded-[24px] border border-dashed border-[#d8c5b6] bg-white/70 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]">
                    <ImageUp size={16} strokeWidth={2} />
                    Add images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        appendGalleryFiles(files);
                        event.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-[#7b6d5f]">
                    Drag images below to change the public order.
                  </p>
                </div>

                {galleryItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {galleryItems.map((item, index) => {
                      const src = item.kind === "existing" ? item.url : item.previewUrl;

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedGalleryId(item.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (draggedGalleryId) {
                              moveGalleryItemById(draggedGalleryId, item.id);
                            }
                            setDraggedGalleryId(null);
                          }}
                          onDragEnd={() => setDraggedGalleryId(null)}
                          className="grid gap-2 rounded-[20px] border border-[#e3d4c6] bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#7b6d5f]">
                              <GripVertical size={14} strokeWidth={2} />
                              #{index + 1}
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#fff3f1] hover:text-[#a94135]"
                              onClick={() => removeGalleryItem(index)}
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <X size={14} strokeWidth={2} />
                            </button>
                          </div>

                          <div
                            className={[
                              "overflow-hidden rounded-[18px] border border-[#e3d4c6] bg-[#f6efe6]",
                              form.gallery_style === "square" ? "aspect-square" : "aspect-video",
                            ].join(" ")}
                          >
                            <img src={src} alt={item.label} className="h-full w-full object-cover" />
                          </div>

                          <div className="text-xs leading-5 text-[#7b6d5f]">
                            {item.kind === "upload" ? `New upload · ${item.label}` : item.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#7b6d5f]">No gallery images yet.</p>
                )}
              </div>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                disabled={saving}
              >
                <Save size={16} strokeWidth={2} />
                {saving ? "Saving..." : "Save workshop program"}
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
                {previewSummary ? (
                  <p className="mt-3 text-sm text-[#7b6d5f]">{previewSummary}</p>
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

            <section className="">
              <p className="text-sm text-[#7b6d5f] whitespace-pre-line">
                {previewContent || "No content yet."}
              </p>
            </section>

            {galleryItems.length > 0 ? (
              <section className="grid gap-3 rounded-[22px] border border-[#e3d4c6] bg-white/80 p-4">
                <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                  Gallery preview
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {galleryItems.map((item) => (
                    <div
                      key={item.id}
                      className={[
                        "overflow-hidden rounded-[18px] border border-[#e3d4c6] bg-[#f6efe6] aspect-square",
                      ].join(" ")}
                    >
                      <img
                        src={item.kind === "existing" ? item.url : item.previewUrl}
                        alt={item.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="text-sm text-[#7b6d5f]">
              {categories.find((category) => category.id === form.category_id)?.title_en || "No category selected"}
              {selectedProgram ? ` · Last updated ${formatDateTime(selectedProgram.updated_at)}` : ""}
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
              This will permanently delete the workshop program and its gallery images.
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
