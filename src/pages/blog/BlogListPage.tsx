import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PencilLine, Plus, RefreshCw, Search } from "lucide-react";
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

export default function BlogListPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus>("all");

  const loadPosts = async () => {
    setLoading(true);
    setError("");

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

  const visiblePosts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesSearch =
        term.length === 0 ||
        [post.title_th, post.title_en, post.slug]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesStatus =
        statusFilter === "all" ? true : post.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [posts, search, statusFilter]);

  const getDisplayTitle = (post: BlogPost) => post.title_th || post.title_en;

  return (
    <section className="grid gap-4">
      <section className="rounded-[28px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.9)] px-6 py-6 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
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
              { label: "All", value: posts.length },
              {
                label: "Published",
                value: posts.filter((post) => post.status === "published").length,
              },
              { label: "Draft", value: posts.filter((post) => post.status === "draft").length },
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

      <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-4 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_160px]">
            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Search</span>
              <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#e3d4c6] bg-white px-3">
                <Search size={16} className="shrink-0 text-[#9d7b68]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title or page link"
                  className="w-full bg-transparent text-sm text-[#2f2a24] outline-none placeholder:text-[#b39f8f]"
                />
              </div>
            </label>

            <label className="grid gap-2 text-sm text-[#7b6d5f]">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | BlogStatus)
                }
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
              onClick={loadPosts}
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

      <section className="rounded-[24px] border border-[#e3d4c6] bg-[rgba(255,253,249,0.88)] p-5 shadow-[0_14px_36px_rgba(65,43,27,0.06)]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-[#7b6d5f] uppercase">
              Article list
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#2f2a24]">
              {visiblePosts.length} items
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[#7b6d5f]">Loading articles...</p>
        ) : visiblePosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e3d4c6] bg-white/70 p-5">
            <h3 className="text-lg font-semibold text-[#2f2a24]">No articles yet</h3>
            <p className="mt-1 text-sm leading-6 text-[#7b6d5f]">
              Create your first article to start managing public content.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visiblePosts.map((post) => (
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
      </section>
    </section>
  );
}
