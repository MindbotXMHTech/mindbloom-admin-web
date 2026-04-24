import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImageUp, Save, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  emptyForm,
  formatDate,
  postToForm,
  slugify,
  statusClass,
  statusLabel,
  type BlogFormState,
  type BlogPost,
} from "./blogShared";
import { LoadingBlock } from "../../components/ui/loading";

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

export default function BlogEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id;
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [form, setForm] = useState<BlogFormState>(() => emptyForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [activeLanguage, setActiveLanguage] = useState<"th" | "en">("th");

  const loadPosts = async () => {
    const { data, error: queryError } = await supabase
      .from("blog_posts")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setPosts([]);
      setLoading(false);
      return;
    }

    setPosts((data ?? []) as BlogPost[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    if (!saveNotice) return undefined;

    const timeout = window.setTimeout(() => {
      setSaveNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [saveNotice]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === id) ?? null,
    [id, posts],
  );

  useEffect(() => {
    if (!isNew && selectedPost) {
      setForm(postToForm(selectedPost));
      setSlugTouched(true);
      setCoverFile(null);
      setActiveLanguage("th");
      return;
    }

    if (isNew) {
      const nextSortOrder =
        posts.length === 0 ? 0 : Math.max(...posts.map((post) => post.sort_order)) + 1;
      setForm(emptyForm(nextSortOrder));
      setSlugTouched(false);
      setCoverFile(null);
      setActiveLanguage("th");
    }
  }, [isNew, posts, selectedPost]);

  useEffect(() => {
    if (coverFile) {
      const localPreviewUrl = URL.createObjectURL(coverFile);
      setCoverPreviewUrl(localPreviewUrl);

      return () => {
        URL.revokeObjectURL(localPreviewUrl);
      };
    }

    setCoverPreviewUrl(form.cover_image_url);
    return undefined;
  }, [coverFile, form.cover_image_url]);

  const handleFieldChange = (field: keyof BlogFormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (!slugTouched && (field === "title_en" || field === "title_th") && !current.slug) {
        next.slug = slugify(value);
      }

      return next;
    });
  };

  const previewTitle =
    activeLanguage === "th"
      ? form.title_th.trim() || form.title_en.trim() || "Untitled"
      : form.title_en.trim() || form.title_th.trim() || "Untitled";
  const coverImageLabel = coverFile
    ? `Selected: ${coverFile.name}`
    : form.cover_image_url
      ? `Current image: ${form.cover_image_url.split("/").pop() || "uploaded image"}`
      : "No cover image selected yet.";
  const statusDescription =
    form.status === "published"
      ? "This article is visible on the website."
      : form.status === "archived"
        ? "This article is hidden from the website."
        : "This article is saved but not visible yet.";

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaveNotice(null);

    let coverImageUrl = form.cover_image_url.trim();

    if (coverFile) {
      const ext = coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeSlug = form.slug.trim() || slugify(previewTitle);
      const filePath = `blog/${safeSlug}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("content-images")
        .upload(filePath, coverFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: coverFile.type || undefined,
        });

      if (uploadError) {
        setSaveNotice({ type: "error", message: uploadError.message });
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("content-images")
        .getPublicUrl(filePath);
      coverImageUrl = publicUrlData.publicUrl;
    }

    if (!coverImageUrl) {
      setSaveNotice({
        type: "error",
        message: "Please choose a cover image from your device.",
      });
      setSaving(false);
      return;
    }

    const missingFields = [
      !form.slug.trim() ? "page link" : "",
      !form.title_th.trim() ? "Thai title" : "",
      !form.title_en.trim() ? "English title" : "",
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

    const publishedAt =
      form.status === "published"
        ? selectedPost?.published_at ?? new Date().toISOString()
        : null;

    const payload = {
      slug: form.slug.trim(),
      title_th: form.title_th.trim(),
      title_en: form.title_en.trim(),
      content_th: form.content_th.trim(),
      content_en: form.content_en.trim(),
      cover_image_url: coverImageUrl,
      youtube_url: form.youtube_url.trim() || null,
      status: form.status,
      published_at: publishedAt,
      sort_order: Number(form.sort_order) || 0,
    };

    const mutation = form.id
      ? supabase.from("blog_posts").update(payload).eq("id", form.id)
      : supabase.from("blog_posts").insert(payload);

    const { data, error: saveError } = await mutation.select().maybeSingle();

    if (saveError) {
      setSaveNotice({ type: "error", message: saveError.message });
      setSaving(false);
      return;
    }

    await loadPosts();
    setSaving(false);
    setSaveNotice({
      type: "success",
      message: "Article saved successfully.",
    });

    if (data) {
      const savedPost = data as BlogPost;
      setForm(postToForm(savedPost));
      setSlugTouched(true);
      setCoverFile(null);
      navigate(`/blog/edit/${savedPost.id}`, { replace: true });
      return;
    }

    if (!form.id) {
      setForm(emptyForm(Number(form.sort_order) + 1));
      setSlugTouched(false);
      setCoverFile(null);
      navigate("/blog/create", { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");
    setSaveNotice(null);

    const storageObjectPaths = new Set<string>();
    const coverPath = getStorageObjectPath(deleteTarget.cover_image_url);

    if (coverPath) {
      storageObjectPaths.add(coverPath);
    }

    const { data: folderItems, error: listError } = await supabase.storage
      .from(CONTENT_IMAGE_BUCKET)
      .list("blog", {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      setSaveNotice({ type: "error", message: listError.message });
      setSaving(false);
      return;
    }

    folderItems?.forEach((item) => {
      if (item.name?.startsWith(`${deleteTarget.slug}-`)) {
        storageObjectPaths.add(`blog/${item.name}`);
      }
    });

    if (storageObjectPaths.size > 0) {
      const { error: storageError } = await supabase.storage
        .from(CONTENT_IMAGE_BUCKET)
        .remove([...storageObjectPaths]);

      if (storageError) {
        setSaveNotice({ type: "error", message: storageError.message });
        setSaving(false);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("blog_posts")
      .delete()
      .eq("id", deleteTarget.id);

    if (deleteError) {
      setSaveNotice({ type: "error", message: deleteError.message });
      setSaving(false);
      return;
    }

    setDeleteTarget(null);
    await loadPosts();
    setSaving(false);
    navigate("/blog", { replace: true });
  };

  if (!isNew && loading) {
    return (
      <section className="grid gap-4">
        <section className="grid gap-3 rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <LoadingBlock className="h-4 w-32 rounded-full" />
          <LoadingBlock className="h-10 w-52 rounded-full" />
          <LoadingBlock className="h-4 w-full max-w-2xl rounded-full" />
        </section>
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {Array.from({ length: 7 }, (_, index) => (
              <LoadingBlock
                key={`blog-editor-field-${index}`}
                className={index === 4 ? "h-36 rounded-[22px]" : "h-11 rounded-2xl"}
              />
            ))}
          </article>
          <article className="grid gap-4 rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            <LoadingBlock className="h-56 rounded-[22px]" />
            <LoadingBlock className="h-4 w-2/3 rounded-full" />
            <LoadingBlock className="h-4 w-full rounded-full" />
            <LoadingBlock className="h-4 w-5/6 rounded-full" />
          </article>
        </section>
      </section>
    );
  }

  const title = isNew ? "Create article" : "Edit article";

  return (
    <section className="grid gap-4">
      <section className="rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Blog / {isNew ? "Create article" : "Edit article"}
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Use this page to create, update, or delete one article.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
              to="/blog"
            >
              <ArrowLeft size={16} strokeWidth={2} />
              Back to list
            </Link>
            {!isNew ? (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#a941352e] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[rgba(169,65,53,0.08)]"
                onClick={() => setDeleteTarget(selectedPost)}
                disabled={!selectedPost}
              >
                <Trash2 size={16} strokeWidth={2} />
                Delete article
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {error}
        </p>
      ) : null}

      {saveNotice ? (
        <div
          className={[
            "fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(65,43,27,0.18)] backdrop-blur-md",
            saveNotice.type === "success"
              ? "border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] text-[#35613a]"
              : "border-[#e3b6af] bg-[rgba(255,238,235,0.98)] text-[#8e3a32]",
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <strong className="text-sm font-semibold">
                {saveNotice.type === "success" ? "Saved" : "Save failed"}
              </strong>
              <span className="text-sm leading-6">{saveNotice.message}</span>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
              aria-label="Close notification"
              onClick={() => setSaveNotice(null)}
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {!isNew && !selectedPost ? (
        <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[#2f2a24]">Article not found</h2>
          <p className="mt-2 text-sm leading-6 text-[#7b6d5f]">
            Go back to the article list and choose another item.
          </p>
        </section>
      ) : (
        <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <form className="grid gap-3" onSubmit={handleSave}>
            <label className="grid gap-1 text-sm text-[#7b6d5f]">
              <span>Page link</span>
              <input
                type="text"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  handleFieldChange("slug", event.target.value);
                }}
                placeholder="article-page-link"
                required
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
              />
              <small className="mt-0.5 text-xs leading-5 text-[#7b6d5f]">
                Used in the web address. Example: living-with-someone-with-depression
              </small>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={[
                  "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
                  activeLanguage === "th"
                    ? "border-[#6f4f40] text-[#2f2a24]"
                    : "border-transparent text-[#7b6d5f] hover:text-[#2f2a24]",
                ].join(" ")}
                onClick={() => setActiveLanguage("th")}
              >
                Thai
              </button>
              <button
                type="button"
                className={[
                  "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
                  activeLanguage === "en"
                    ? "border-[#6f4f40] text-[#2f2a24]"
                    : "border-transparent text-[#7b6d5f] hover:text-[#2f2a24]",
                ].join(" ")}
                onClick={() => setActiveLanguage("en")}
              >
                English
              </button>
            </div>

            <p className="text-sm leading-6 text-[#7b6d5f]">
              Editing {activeLanguage === "th" ? "Thai" : "English"} only. Switch the tab to
              check the other language.
            </p>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
              <div className="space-y-4">
                <label className="grid gap-1 text-sm text-[#7b6d5f]">
                  <span>{activeLanguage === "th" ? "Title TH" : "Title EN"}</span>
                  <input
                    type="text"
                    value={activeLanguage === "th" ? form.title_th : form.title_en}
                    onChange={(event) =>
                      handleFieldChange(
                        activeLanguage === "th" ? "title_th" : "title_en",
                        event.target.value,
                      )
                    }
                    placeholder={activeLanguage === "th" ? "หัวข้อภาษาไทย" : "English title"}
                    className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                  />
                </label>

                <label className="grid gap-1 text-sm text-[#7b6d5f]">
                  <span>{activeLanguage === "th" ? "Content TH" : "Content EN"}</span>
                  <textarea
                    rows={16}
                    value={activeLanguage === "th" ? form.content_th : form.content_en}
                    onChange={(event) =>
                      handleFieldChange(
                        activeLanguage === "th" ? "content_th" : "content_en",
                        event.target.value,
                      )
                    }
                    placeholder={
                      activeLanguage === "th"
                        ? "พิมพ์เนื้อหาภาษาไทย"
                        : "Write the English content"
                    }
                    className="min-h-[18rem] rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                  />
                </label>

                <div className="grid gap-2.5 rounded-[24px] border border-[#e3d4c6] bg-white/75 p-4">
                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>Cover image</span>
                    <div className="grid gap-2 rounded-2xl border border-dashed border-[#d8c5b6] bg-white/70 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]">
                          <ImageUp size={16} strokeWidth={2} />
                          Choose from device
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setCoverFile(file);
                            }}
                            className="hidden"
                          />
                        </label>
                        <p className="text-sm text-[#7b6d5f]">{coverImageLabel}</p>
                      </div>
                      <p className="text-xs leading-5 text-[#7b6d5f]">
                        Pick an image from your device. We will upload it for you.
                      </p>
                    </div>
                  </label>

                  <label className="grid gap-1 text-sm text-[#7b6d5f]">
                    <span>YouTube URL</span>
                    <input
                      type="url"
                      value={form.youtube_url}
                      onChange={(event) =>
                        handleFieldChange("youtube_url", event.target.value)
                      }
                      placeholder="https://youtube.com/..."
                      className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                    />
                  </label>

                  <div className="grid gap-2.5 md:grid-cols-[140px_minmax(0,1fr)]">
                    <label className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={(event) => handleFieldChange("status", event.target.value)}
                        className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>

                    <div className="grid gap-0.5 self-end text-sm">
                      <span className="text-[#7b6d5f]">Visibility</span>
                      <p className="leading-6 text-[#7b6d5f]">{statusDescription}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                        Preview: {activeLanguage === "th" ? "Thai" : "English"}
                      </div>
                      <h3 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                        {previewTitle}
                      </h3>
                    </div>
                    <span className={statusClass(form.status)}>{statusLabel(form.status)}</span>
                  </div>

                  <div className="overflow-hidden rounded-[22px] border border-[#e3d4c6] bg-[#faf7f3]">
                    {coverPreviewUrl ? (
                      <img
                        src={coverPreviewUrl}
                        alt={previewTitle}
                        className="mx-auto block h-auto max-h-[420px] w-full max-w-[420px] object-contain p-4"
                      />
                    ) : (
                      <div className="grid min-h-[220px] place-items-center px-4 py-10">
                        <p className="text-sm text-[#7b6d5f]">No image selected yet.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 grid gap-2.5">
                    <div className="grid gap-2.5 text-sm leading-7 text-[#2f2a24]">
                      {(activeLanguage === "th" ? form.content_th : form.content_en)
                        .split(/\n{2,}/)
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                    </div>

                    <div className="grid gap-1 text-sm text-[#7b6d5f]">
                      <span>{form.slug || "no-page-link"}</span>
                      <span>{form.youtube_url || "no-youtube-link"}</span>
                    </div>

                    <p className="text-sm leading-6 text-[#7b6d5f]">{statusDescription}</p>
                    {selectedPost ? (
                      <p className="text-sm leading-6 text-[#7b6d5f]">
                        Last updated {formatDate(selectedPost.updated_at)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                    disabled={saving}
                  >
                    <Save size={16} strokeWidth={2} />
                    {saving ? "Saving..." : "Save article"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}

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
              This will permanently delete the article from Supabase.
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
    </section>
  );
}
