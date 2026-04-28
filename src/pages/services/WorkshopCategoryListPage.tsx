import { useEffect, useMemo, useState, type FormEvent } from "react";
import { GripVertical, PencilLine, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "../../components/ui/adminButtonStyles";
import { LoadingBlock } from "../../components/ui/loading";
import ServicesSubnav from "./ServicesSubnav";
import { formatDateTime, normalizeInlineText, slugify, type WorkshopCategoryRecord } from "./workshopShared";

type CategoryModalState = {
  id?: string;
  title: string;
  description_th: string;
  description_en: string;
  active: boolean;
};

const emptyModalState: CategoryModalState = {
  title: "",
  description_th: "",
  description_en: "",
  active: true,
};

export default function WorkshopCategoryListPage() {
  const [categories, setCategories] = useState<WorkshopCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [modal, setModal] = useState<CategoryModalState | null>(null);
  const [savingModal, setSavingModal] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setDraggedId(null);

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

    const nextCategories = (data ?? []) as WorkshopCategoryRecord[];
    setCategories(nextCategories);
    setOrderedIds(nextCategories.map((category) => category.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const orderedCategories = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category] as const));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as WorkshopCategoryRecord[];
    const remaining = categories.filter((category) => !orderedIds.includes(category.id));
    return [...ordered, ...remaining];
  }, [categories, orderedIds]);

  const visibleCategories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orderedCategories.filter((category) => {
      const matchesSearch =
        term.length === 0 ||
        [category.title_th, category.title_en, category.subtitle_th, category.subtitle_en]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesActive =
        activeFilter === "all"
          ? true
          : activeFilter === "active"
            ? category.active
            : !category.active;

      return matchesSearch && matchesActive;
    });
  }, [activeFilter, orderedCategories, search]);

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setOrderedIds((current) => {
      const next = current.filter((id) => id !== fromId);
      const targetIndex = next.indexOf(toId);

      if (targetIndex === -1) {
        return [...next, fromId];
      }

      next.splice(targetIndex, 0, fromId);
      return next;
    });
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setError("");
    setNotice("");

    const updates = orderedIds.map((id, index) =>
      supabase.from("workshop_categories").update({ sort_order: index }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setSavingOrder(false);
      return;
    }

    await loadCategories();
    setNotice("Order saved successfully.");
    setSavingOrder(false);
  };

  const openCreateModal = () => {
    setError("");
    setModal({ ...emptyModalState });
  };

  const openEditModal = (category: WorkshopCategoryRecord) => {
    setError("");
    setModal({
      id: category.id,
      title: category.title_th || category.title_en,
      description_th: category.subtitle_th,
      description_en: category.subtitle_en,
      active: category.active,
    });
  };

  const updateModalField = (field: keyof CategoryModalState, value: string | boolean) => {
    setModal((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSaveModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;

    setSavingModal(true);
    setError("");
    setNotice("");

    const title = normalizeInlineText(modal.title);
    const descriptionTh = normalizeInlineText(modal.description_th);
    const descriptionEn = normalizeInlineText(modal.description_en);

    if (!title) {
      setError("Please fill in: title.");
      setSavingModal(false);
      return;
    }

    const nextSortOrder =
      categories.length === 0 ? 0 : Math.max(...categories.map((category) => category.sort_order)) + 1;

    const source = categories.find((category) => category.id === modal.id);
    const payload = {
      slug: source?.slug || slugify(title) || `workshop-category-${Date.now()}`,
      title_th: title,
      title_en: title,
      subtitle_th: descriptionTh,
      subtitle_en: descriptionEn,
      sort_order: modal.id ? source?.sort_order ?? 0 : nextSortOrder,
      active: modal.active,
    };

    const mutation = modal.id
      ? supabase.from("workshop_categories").update(payload).eq("id", modal.id)
      : supabase.from("workshop_categories").insert(payload);

    const { error: saveError } = await mutation;

    if (saveError) {
      setError(saveError.message);
      setSavingModal(false);
      return;
    }

    await loadCategories();
    setNotice(modal.id ? "Workshop category updated." : "Workshop category created.");
    setSavingModal(false);
    setModal(null);
  };

  const handleDeleteModal = async () => {
    if (!modal?.id) return;

    setSavingModal(true);
    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("workshop_categories")
      .delete()
      .eq("id", modal.id);

    if (deleteError) {
      setError(deleteError.message);
      setSavingModal(false);
      return;
    }

    await loadCategories();
    setNotice("Workshop category deleted.");
    setSavingModal(false);
    setModal(null);
  };

  return (
    <>
      <section className="grid content-start gap-4">
        <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                Services management
              </div>
              <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
                Workshop categories
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
                Manage workshop categories with a shared title and bilingual description.
              </p>
            </div>
            <ServicesSubnav />
          </div>
        </section>

        <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="flex w-full flex-wrap items-end justify-between gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px]">
              <label className="grid gap-2 text-sm text-[#7b6d5f]">
                <span>Search</span>
                <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#e3d4c6] bg-white px-3">
                  <Search size={16} className="shrink-0 text-[#9d7b68]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title or description"
                    className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                  />
                </div>
              </label>

              <label className="grid gap-2 text-sm text-[#7b6d5f]">
                <span>Status</span>
                <select
                  value={activeFilter}
                  onChange={(event) =>
                    setActiveFilter(event.target.value as "all" | "active" | "inactive")
                  }
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" className={adminSecondaryButtonClass} onClick={loadCategories}>
                <RefreshCw size={16} strokeWidth={2} />
                Refresh
              </button>
              <button type="button" onClick={openCreateModal} className={adminPrimaryButtonClass}>
                <Plus size={16} strokeWidth={2} />
                New category
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="rounded-2xl border border-[#b9d7b1] bg-[rgba(237,247,233,0.98)] px-4 py-3 text-sm text-[#35613a] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
            {notice}
          </p>
        ) : null}

        <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
                Workshop category list
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
                {visibleCategories.length} items
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <article
                  key={`workshop-category-loading-${index}`}
                  className="grid gap-3 rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
                >
                  <LoadingBlock className="h-5 w-2/3 rounded-full" />
                  <LoadingBlock className="h-4 w-1/3 rounded-full" />
                  <LoadingBlock className="h-4 w-full rounded-full" />
                </article>
              ))}
            </div>
          ) : visibleCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
              <h3 className="text-lg font-semibold text-[#2f2a24]">No workshop categories yet</h3>
              <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
                Create your first workshop category to organize the public workshop page.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {visibleCategories.map((category) => (
                <article
                  key={category.id}
                  draggable
                  onDragStart={() => setDraggedId(category.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedId) {
                      moveItem(draggedId, category.id);
                    }
                    setDraggedId(null);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className="rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f]"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical size={16} strokeWidth={2} />
                      </button>

                      <div className="grid min-w-0 flex-1 content-center gap-2 py-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid min-w-0 gap-1">
                            <strong className="block text-[15px] leading-6 font-semibold text-[#2f2a24]">
                              {category.title_th || category.title_en}
                            </strong>
                            {category.subtitle_th || category.subtitle_en ? (
                              <p className="line-clamp-2 text-sm leading-6 text-[#7b6d5f]">
                                {category.subtitle_th || category.subtitle_en}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={[
                              "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                              category.active
                                ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                                : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                            ].join(" ")}
                          >
                            {category.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-[#9c8c7e]">
                          <span>Updated {formatDateTime(category.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      <button
                        type="button"
                        className={adminIconButtonClass}
                        onClick={() => openEditModal(category)}
                        aria-label={`Edit ${category.title_en}`}
                        title="Edit workshop category"
                      >
                        <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!loading && visibleCategories.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#7b6d5f]">
                Drag workshop categories to reorder them, then save the new order.
              </p>
              <button
                type="button"
                className={adminPrimaryButtonClass}
                onClick={handleSaveOrder}
                disabled={savingOrder}
              >
                <RefreshCw size={16} strokeWidth={2} />
                {savingOrder ? "Saving..." : "Save order"}
              </button>
            </div>
          ) : null}
        </section>
      </section>

      {modal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(37,27,19,0.36)] p-5 backdrop-blur-sm">
          <div className="w-full max-w-[620px] rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.96)] p-6 shadow-[0_20px_50px_rgba(65,43,27,0.18)]">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              {modal.id ? "Edit category" : "Create category"}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              Workshop category
            </h2>

            <form className="mt-5 grid gap-4" onSubmit={handleSaveModal}>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#7b6d5f]">Title (shared TH/EN)</span>
                <input
                  type="text"
                  value={modal.title}
                  onChange={(event) => updateModalField("title", event.target.value)}
                  className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-4 text-sm text-[#2f2a24] outline-none"
                  placeholder="Preventive & Awareness"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#7b6d5f]">Description (TH)</span>
                  <textarea
                    rows={3}
                    value={modal.description_th}
                    onChange={(event) => updateModalField("description_th", event.target.value)}
                    className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[#7b6d5f]">Description (EN)</span>
                  <textarea
                    rows={3}
                    value={modal.description_en}
                    onChange={(event) => updateModalField("description_en", event.target.value)}
                    className="rounded-[22px] border border-[#e3d4c6] bg-white px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#e3d4c6] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={modal.active}
                  onChange={(event) => updateModalField("active", event.target.checked)}
                  className="h-4 w-4 accent-[#6f4f40]"
                />
                <span className="text-sm font-medium text-[#2f2a24]">Active</span>
              </label>

              <div className="mt-1 flex flex-wrap justify-between gap-3">
                <div>
                  {modal.id ? (
                    <button
                      type="button"
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6c7c3] bg-white px-4 text-sm font-medium text-[#a94135] transition-colors hover:bg-[#fff3f1]"
                      onClick={handleDeleteModal}
                      disabled={savingModal}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                      {savingModal ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[#e3d4c6] bg-white px-4 text-sm font-medium text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                    onClick={() => setModal(null)}
                    disabled={savingModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[#6f4f40] px-4 text-sm font-medium text-white transition-colors hover:bg-[#5d4337]"
                    disabled={savingModal}
                  >
                    {savingModal ? "Saving..." : "Save category"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
