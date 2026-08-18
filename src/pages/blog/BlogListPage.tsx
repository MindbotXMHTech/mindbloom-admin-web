import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminIconButtonClass,
} from "../../components/ui/adminButtonStyles";
import {
  formatDate,
  getBlogPreviewText,
  statusClass,
  statusLabel,
  type BlogPost,
  type BlogStatus,
} from "./blogShared";
import { LoadingBlock } from "../../components/ui/loading";

const POSTS_PER_PAGE = 10;
type BlogSort = "newest" | "oldest";
type BlogStats = {
  all: number;
  published: number;
  draft: number;
};

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) {
      pages.add(page);
    }
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  return sortedPages.flatMap((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page] as const;
    }

    return [page] as const;
  });
}

function escapeSearchTerm(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`).replace(/[(),]/g, " ");
}

export default function BlogListPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [stats, setStats] = useState<BlogStats>({
    all: 0,
    published: 0,
    draft: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus>("all");
  const [sortBy, setSortBy] = useState<BlogSort>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const loadPosts = async () => {
    setLoading(true);
    setError("");

    const term = search.trim();
    const pageStartIndex = (currentPage - 1) * POSTS_PER_PAGE;
    let query = supabase
      .from("blog_posts")
      .select("*", { count: "exact" });

    if (term) {
      const searchTerm = escapeSearchTerm(term);
      query = query.or(
        `title_th.ilike.%${searchTerm}%,title_en.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`,
      );
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: queryError, count } = await query
      .order("created_at", { ascending: sortBy === "oldest" })
      .range(pageStartIndex, pageStartIndex + POSTS_PER_PAGE - 1);

    if (queryError) {
      setError(queryError.message);
      setPosts([]);
      setTotalPosts(0);
      setLoading(false);
      return;
    }

    setPosts((data ?? []) as BlogPost[]);
    setTotalPosts(count ?? 0);
    setLoading(false);
  };

  const loadStats = async () => {
    const [allResult, publishedResult, draftResult] = await Promise.all([
      supabase.from("blog_posts").select("id", { count: "exact", head: true }),
      supabase
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);

    setStats({
      all: allResult.count ?? 0,
      published: publishedResult.count ?? 0,
      draft: draftResult.count ?? 0,
    });
  };

  useEffect(() => {
    void loadPosts();
  }, [currentPage, search, sortBy, statusFilter]);

  useEffect(() => {
    void loadStats();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  const firstVisibleItem = totalPosts === 0 ? 0 : (currentPage - 1) * POSTS_PER_PAGE + 1;
  const lastVisibleItem = Math.min(currentPage * POSTS_PER_PAGE, totalPosts);
  const paginationItems = getPaginationItems(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const getDisplayTitle = (post: BlogPost) => post.title_th || post.title_en;

  return (
    <section className="grid content-start gap-4">
      <section className="self-start rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Blog management
            </div>
            <h1 className="text-[clamp(30px,3vw,44px)] font-semibold tracking-tight text-[#2f2a24]">
              บทความ
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[#7b6d5f]">
              One page for article list, separate page for create and edit.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "All", value: stats.all },
              { label: "Published", value: stats.published },
              { label: "Draft", value: stats.draft },
            ].map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-2xl border border-[#e3d4c6] bg-white/75 px-4 py-3"
              >
                <div className="text-xs font-medium text-[#7b6d5f]">{stat.label}</div>
                <strong className="mt-1 block text-2xl font-semibold tracking-tight text-[#2f2a24]">
                  {stat.value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px]">
            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Search</span>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#e3d4c6] bg-white px-3">
                <Search size={16} className="shrink-0 text-[#9d7b68]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setCurrentPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Search by title or page link"
                  className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setCurrentPage(1);
                  setStatusFilter(event.target.value as "all" | BlogStatus);
                }}
                className="h-11 rounded-2xl border border-[#e3d4c6] bg-white px-3 text-sm text-[#2f2a24] outline-none"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => {
                setCurrentPage(1);
                setSortBy((currentSort) => (currentSort === "newest" ? "oldest" : "newest"));
              }}
            >
              <ArrowDownUp size={16} strokeWidth={2} />
              {sortBy === "newest" ? "Newest first" : "Oldest first"}
            </button>
            <button
              type="button"
              className={adminSecondaryButtonClass}
              onClick={() => {
                void loadStats();
                void loadPosts();
              }}
            >
              <RefreshCw size={16} strokeWidth={2} />
              Refresh
            </button>
            <button
              type="button"
              className={adminPrimaryButtonClass}
              onClick={() => navigate("/blog/create")}
            >
              <Plus size={16} strokeWidth={2} />
              New article
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] px-4 py-3 text-sm text-[#a94135] shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
          {error}
        </p>
      ) : null}

      <section className="self-start rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Article list
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {totalPosts} items
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <article
                key={`blog-loading-row-${index}`}
                className="grid gap-3 rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 grid gap-2">
                    <LoadingBlock className="h-5 w-2/3 rounded-full" />
                    <LoadingBlock className="h-4 w-1/4 rounded-full" />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <LoadingBlock className="h-4 w-24 rounded-full" />
                      <LoadingBlock className="h-4 w-16 rounded-full" />
                    </div>
                    <LoadingBlock className="h-4 w-full rounded-full" />
                    <LoadingBlock className="h-4 w-5/6 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <LoadingBlock className="h-7 w-20 rounded-full" />
                    <LoadingBlock className="h-10 w-10 rounded-2xl" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : totalPosts === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <h3 className="text-lg font-semibold text-[#2f2a24]">No articles yet</h3>
            <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
              Create your first article to start managing public content.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-[20px] border border-[#e3d4c6] bg-white/80 p-4 shadow-[0_10px_24px_rgba(65,43,27,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="block text-[15px] font-semibold text-[#2f2a24]">
                        {getDisplayTitle(post)}
                      </strong>
                      <div className="flex items-center gap-2">
                        <span className={statusClass(post.status)}>
                          {statusLabel(post.status)}
                        </span>
                        <Link
                          className={adminIconButtonClass}
                          to={`/blog/edit/${post.id}`}
                          aria-label={`Edit ${getDisplayTitle(post)}`}
                          title="Edit article"
                        >
                          <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-1 text-sm text-[#7b6d5f]">{post.slug}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#7b6d5f]">
                      <span>Updated {formatDate(post.updated_at)}</span>
                      <span>Sort {post.sort_order}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#7b6d5f]">
                      {getBlogPreviewText(post.content_en, post.content_th, "th")}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && totalPosts > POSTS_PER_PAGE ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3d4c6] pt-4">
            <p className="text-sm text-[#7b6d5f]">
              Showing {firstVisibleItem}-{lastVisibleItem} of {totalPosts}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-[#7b6d5f]"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              {paginationItems.map((item) => {
                if (typeof item === "string") {
                  return (
                    <span
                      key={item}
                      className="inline-flex h-10 min-w-6 items-center justify-center text-sm font-medium text-[#7b6d5f]"
                      aria-hidden="true"
                    >
                      ...
                    </span>
                  );
                }

                const pageNumber = item;
                const isCurrentPage = pageNumber === currentPage;

                return (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors ${
                      isCurrentPage
                        ? "border-[#6f4f40] bg-[#6f4f40] text-white"
                        : "border-[#e3d4c6] bg-white text-[#7b6d5f] hover:bg-[#f7efe6] hover:text-[#2f2a24]"
                    }`}
                    onClick={() => setCurrentPage(pageNumber)}
                    aria-current={isCurrentPage ? "page" : undefined}
                    aria-label={`Go to page ${pageNumber}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d4c6] bg-white text-[#7b6d5f] transition-colors hover:bg-[#f7efe6] hover:text-[#2f2a24] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:text-[#7b6d5f]"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
