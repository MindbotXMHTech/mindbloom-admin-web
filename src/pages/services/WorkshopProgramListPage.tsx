import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GripVertical, PencilLine, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  adminIconButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "../../components/ui/adminButtonStyles";
import { LoadingBlock } from "../../components/ui/loading";
import ServicesSubnav from "./ServicesSubnav";
import {
  formatDateTime,
  getWorkshopProgramAutoCtaIds,
  getWorkshopProgramPreviewText,
  type WorkshopCategoryRecord,
  type WorkshopProgramRecord,
} from "./workshopShared";

export default function WorkshopProgramListPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<WorkshopCategoryRecord[]>([]);
  const [programs, setPrograms] = useState<WorkshopProgramRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setDraggedId(null);

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

    const nextCategories = (categoryData ?? []) as WorkshopCategoryRecord[];
    const nextPrograms = (programData ?? []) as WorkshopProgramRecord[];
    const categoryOrder = new Map(nextCategories.map((category) => [category.id, category.sort_order] as const));
    const sortedPrograms = [...nextPrograms].sort((a, b) => {
      const categoryDiff = (categoryOrder.get(a.category_id) ?? 0) - (categoryOrder.get(b.category_id) ?? 0);
      if (categoryDiff !== 0) return categoryDiff;
      return a.sort_order - b.sort_order;
    });

    setCategories(nextCategories);
    setPrograms(sortedPrograms);
    setOrderedIds(sortedPrograms.map((program) => program.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category] as const)),
    [categories],
  );

  const orderedPrograms = useMemo(() => {
    const byId = new Map(programs.map((program) => [program.id, program] as const));
    const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as WorkshopProgramRecord[];
    const remaining = programs.filter((program) => !orderedIds.includes(program.id));
    return [...ordered, ...remaining];
  }, [orderedIds, programs]);

  const visiblePrograms = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orderedPrograms.filter((program) => {
      const matchesSearch =
        term.length === 0 ||
        [
          program.title_th,
          program.title_en,
          categoryMap.get(program.category_id)?.title_th ?? "",
          categoryMap.get(program.category_id)?.title_en ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesActive =
        activeFilter === "all"
          ? true
          : activeFilter === "active"
            ? program.active
            : !program.active;

      const matchesCategory =
        categoryFilter === "all" ? true : program.category_id === categoryFilter;

      return matchesSearch && matchesActive && matchesCategory;
    });
  }, [activeFilter, categoryFilter, categoryMap, orderedPrograms, search]);

  const canReorder =
    (categoryFilter !== "all" || (search.trim().length === 0 && activeFilter === "all")) &&
    !loading &&
    visiblePrograms.length > 1;
  const groupedPrograms = useMemo(() => {
    const grouped = new Map<string, WorkshopProgramRecord[]>();

    visiblePrograms.forEach((program) => {
      const key = program.category_id || "__uncategorized__";
      const existing = grouped.get(key) ?? [];
      existing.push(program);
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries()).map(([categoryId, items]) => ({
      categoryId,
      items,
      category: categoryMap.get(categoryId) ?? null,
    }));
  }, [categoryMap, visiblePrograms]);

  const moveItem = (fromId: string, toId: string, categoryId: string) => {
    if (!canReorder || fromId === toId) return;

    setOrderedIds((current) => {
      const filteredIds = orderedPrograms
        .filter((program) => program.category_id === categoryId)
        .map((program) => program.id);
      const scoped = current.filter((id) => filteredIds.includes(id));
      const fromIndex = scoped.indexOf(fromId);
      const toIndex = scoped.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      const nextScoped = [...scoped];
      const [moved] = nextScoped.splice(fromIndex, 1);
      nextScoped.splice(toIndex, 0, moved);

      const replacementMap = new Map(filteredIds.map((id, index) => [id, nextScoped[index]] as const));
      return current.map((id) => replacementMap.get(id) ?? id);
    });
  };

  const handleSaveOrder = async () => {
    if (!canReorder) return;

    setSavingOrder(true);
    setError("");
    setNotice("");

    const scopedGroups =
      categoryFilter === "all"
        ? groupedPrograms
        : groupedPrograms.filter((group) => group.categoryId === categoryFilter);

    const updates = scopedGroups.flatMap((group) =>
      group.items.map((program, index) =>
        supabase.from("workshop_programs").update({ sort_order: index }).eq("id", program.id),
      ),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setSavingOrder(false);
      return;
    }

    const nextPrograms = programs.map((program) => {
      const nextGroup = scopedGroups.find((group) => group.categoryId === program.category_id);
      const nextIndex = nextGroup?.items.findIndex((visibleProgram) => visibleProgram.id === program.id) ?? -1;

      if (nextIndex === -1) {
        return program;
      }

      return {
        ...program,
        sort_order: nextIndex,
      };
    });

    const autoCtaIds =
      categoryFilter === "all"
        ? getWorkshopProgramAutoCtaIds(nextPrograms)
        : getWorkshopProgramAutoCtaIds(
            nextPrograms.filter((program) => program.category_id === categoryFilter),
          );
    const programsToUpdate = scopedGroups.flatMap((group) => group.items);

    await Promise.all(
      programsToUpdate.map((program) =>
        supabase.from("workshop_programs").update({ show_cta: autoCtaIds.has(program.id) }).eq("id", program.id),
      ),
    );

    await loadData();
    setNotice("Order saved successfully.");
    setSavingOrder(false);
  };

  return (
    <section className="grid content-start gap-4">
      <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Services management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              Workshop programs
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              Manage the detailed workshop programs and galleries shown on the workshop page.
            </p>
          </div>
          <ServicesSubnav />
        </div>
      </section>

      <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex w-full flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px_220px]">
            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Search</span>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#e3d4c6] bg-white px-3">
                <Search size={16} className="shrink-0 text-[#9d7b68]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or category"
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

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title_en}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className={adminSecondaryButtonClass} onClick={loadData}>
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate("/services/workshop-programs/create")}
              className={adminPrimaryButtonClass}
            >
              <Plus size={16} strokeWidth={2} />
              New workshop program
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
              Workshop program list
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {visiblePrograms.length} items
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <article
                key={`workshop-program-loading-${index}`}
                className="grid gap-3 rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <LoadingBlock className="h-5 w-2/3 rounded-full" />
                <LoadingBlock className="h-4 w-1/3 rounded-full" />
                <LoadingBlock className="h-4 w-full rounded-full" />
              </article>
            ))}
          </div>
        ) : visiblePrograms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <h3 className="text-lg font-semibold text-[#2f2a24]">No workshop programs yet</h3>
            <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
              Create your first workshop program to start managing the public workshop page.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {groupedPrograms.map((group) => (
              <section
                key={group.categoryId}
                className="rounded-[20px] border border-[#e3d4c6] bg-[rgba(255,255,255,0.82)] p-3 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#eadbce] bg-[rgba(247,239,230,0.55)] px-3 py-2">
                  <div className="text-sm font-semibold text-[#2f2a24]">
                    {group.category?.title_th || group.category?.title_en || "Unassigned category"}
                  </div>
                  <div className="text-xs text-[#7b6d5f]">
                    {group.items.length} {group.items.length === 1 ? "program" : "programs"}
                  </div>
                </div>

                <div className="grid gap-3">
                  {group.items.map((program) => (
                    <article
                      key={program.id}
                      draggable={canReorder}
                      onDragStart={(event) => {
                        if (!canReorder) return;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", program.id);
                        event.dataTransfer.setDragImage(event.currentTarget, 24, 24);
                        setDraggedId(program.id);
                      }}
                      onDragOver={(event) => canReorder && event.preventDefault()}
                      onDrop={() => {
                        if (draggedId) {
                          moveItem(draggedId, program.id, group.categoryId);
                        }
                        setDraggedId(null);
                      }}
                      onDragEnd={() => setDraggedId(null)}
                      className="cursor-grab rounded-[16px] border border-[#e3d4c6] bg-white/90 p-4 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <div
                            className="inline-flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f]"
                            title={canReorder ? "Drag to reorder" : "Choose a category to reorder"}
                            aria-hidden="true"
                          >
                            <GripVertical size={16} strokeWidth={2} />
                          </div>

                          <div className="grid min-w-0 flex-1 content-center gap-2 py-1">
                            <div className="flex items-start justify-between gap-3">
                              <strong className="block text-[15px] leading-6 font-semibold text-[#2f2a24]">
                                {program.title_th || program.title_en}
                              </strong>
                              <span
                                className={[
                                  "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium",
                                  program.active
                                    ? "bg-[rgba(185,215,177,0.3)] text-[#35613a]"
                                    : "bg-[rgba(231,228,222,0.9)] text-[#7b6d5f]",
                                ].join(" ")}
                              >
                                {program.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-[#9c8c7e]">
                              <span>{program.gallery_image_urls.length} images</span>
                              <span>Updated {formatDateTime(program.updated_at)}</span>
                              <span>Sort {program.sort_order}</span>
                            </div>
                            <p className="line-clamp-2 text-sm leading-6 text-[#7b6d5f]">
                              {getWorkshopProgramPreviewText(
                                program.summary_en,
                                program.summary_th,
                                program.content_en,
                                program.content_th,
                                "th",
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start">
                          <Link
                            className={adminIconButtonClass}
                            to={`/services/workshop-programs/edit/${program.id}`}
                            aria-label={`Edit ${program.title_en}`}
                            title="Edit workshop program"
                          >
                            <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && visiblePrograms.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#7b6d5f]">
              {canReorder
                ? categoryFilter === "all"
                  ? "Drag workshop programs within each category section, then save the new order."
                  : "Drag workshop programs to reorder them within the selected category, then save the new order."
                : "Choose one category, or clear search and status filters, to reorder programs."}
            </p>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              onClick={handleSaveOrder}
              disabled={savingOrder || !canReorder}
            >
              <RefreshCw size={16} strokeWidth={2} />
              {savingOrder ? "Saving..." : "Save order"}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
