import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EditorContent, Extension, useEditor, type CommandProps } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import PlaceholderExtension from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import { NodeSelection, Plugin, type Transaction } from "@tiptap/pm/state";
import {
  Anchor,
  ArrowLeft,
  Bold,
  Heading2,
  Heading3,
  ImageUp,
  IndentDecrease,
  IndentIncrease,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  contentToHtml,
  emptyForm,
  formatDate,
  isBlankContent,
  postToForm,
  slugify,
  statusClass,
  statusLabel,
  type BlogFormState,
  type BlogPost,
} from "./blogShared";
import { LoadingBlock } from "../../components/ui/loading";

const CONTENT_IMAGE_BUCKET = "content-images";

const ALLOWED_CONTENT_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "DIV",
  "EM",
  "H2",
  "H3",
  "I",
  "IMG",
  "LI",
  "OL",
  "P",
  "SPAN",
  "STRONG",
  "U",
  "UL",
]);

const IMAGE_WIDTH_OPTIONS = [320, 480, 640, 800] as const;
const IMAGE_WIDTH_CHOICES = ["full", ...IMAGE_WIDTH_OPTIONS.map(String)] as const;
const MAX_INDENT_LEVEL = 4;
const INDENTABLE_BLOCK_SELECTOR = "p, h2, h3, blockquote";
const IMAGE_BUBBLE_MENU_OPTIONS: NonNullable<ComponentProps<typeof BubbleMenu>["options"]> = {
  placement: "top",
  strategy: "fixed",
};

function normalizeHeadingId(value: string) {
  return slugify(value).slice(0, 80);
}

function isValidHeadingId(value: string) {
  return /^[a-z0-9ก-๙][a-z0-9ก-๙-]{0,79}$/.test(value);
}

function getUniqueHeadingId(baseId: string, usedIds: Set<string>) {
  const fallbackId = baseId || "section";
  let candidate = fallbackId;
  let index = 2;

  while (usedIds.has(candidate)) {
    candidate = `${fallbackId}-${index}`;
    index += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function isAllowedImageSrc(value: string) {
  return /^https?:\/\//i.test(value);
}

function shouldShowImageBubbleMenu({
  editor,
  state,
}: Parameters<NonNullable<ComponentProps<typeof BubbleMenu>["shouldShow"]>>[0]) {
  return (
    editor.isEditable &&
    state.selection instanceof NodeSelection &&
    state.selection.node.type.name === "image"
  );
}

function sanitizeImageWidth(value: number | string | null) {
  if (!value) return null;

  const width = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!IMAGE_WIDTH_OPTIONS.some((option) => option === width)) {
    return null;
  }

  return String(width);
}

function sanitizeIndentLevel(value: string | null) {
  if (!value) return null;

  const level = Number.parseInt(value, 10);
  if (!Number.isInteger(level) || level < 1 || level > MAX_INDENT_LEVEL) {
    return null;
  }

  return String(level);
}

function sanitizeRichContent(value: string) {
  if (typeof window === "undefined") {
    return value;
  }

  const template = document.createElement("template");
  template.innerHTML = contentToHtml(value);
  const originalHeadingIds = new Map<Element, string>();

  template.content.querySelectorAll("*").forEach((element) => {
    if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
      element.remove();
      return;
    }

    if (!ALLOWED_CONTENT_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const originalAttributes = new Map(
      Array.from(element.attributes).map((attribute) => [
        attribute.name.toLowerCase(),
        attribute.value,
      ]),
    );

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });

    if (element.tagName === "H2" || element.tagName === "H3") {
      originalHeadingIds.set(element, originalAttributes.get("id") ?? "");
    }

    if (element.matches(INDENTABLE_BLOCK_SELECTOR)) {
      const indentLevel = sanitizeIndentLevel(originalAttributes.get("data-indent") ?? null);
      if (indentLevel) {
        element.setAttribute("data-indent", indentLevel);
      }
    }

    if (element.tagName === "A") {
      const href = originalAttributes.get("href") ?? "";
      const isHashLink = /^#[a-z0-9ก-๙][a-z0-9ก-๙-]{0,79}$/.test(href);
      const isExternalLink = /^https?:\/\//i.test(href);
      const isMailLink = href.startsWith("mailto:");

      if (isHashLink) {
        element.setAttribute("href", href);
      } else if (isExternalLink || isMailLink) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer");
      }
    }

    if (element.tagName === "IMG") {
      const originalSrc = originalAttributes.get("src") ?? "";
      const originalAlt = originalAttributes.get("alt") ?? "";
      const width = sanitizeImageWidth(originalAttributes.get("width") ?? null);

      if (!isAllowedImageSrc(originalSrc)) {
        element.remove();
        return;
      }

      element.setAttribute("src", originalSrc);
      element.setAttribute("alt", originalAlt.slice(0, 160));

      if (width) {
        element.setAttribute("width", width);
      }
    }

    if (element.tagName === "SPAN" && element.attributes.length === 0) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  });

  const usedHeadingIds = new Set<string>();
  template.content.querySelectorAll("h2, h3").forEach((heading) => {
    const existingId = originalHeadingIds.get(heading) ?? "";
    const normalizedExistingId = normalizeHeadingId(existingId);
    const baseId =
      normalizedExistingId && isValidHeadingId(normalizedExistingId)
        ? normalizedExistingId
        : normalizeHeadingId(heading.textContent ?? "") || "section";

    heading.setAttribute("id", getUniqueHeadingId(baseId, usedHeadingIds));
  });

  return template.innerHTML.trim();
}

type RichTextEditorProps = {
  label: string;
  value: string;
  placeholder: string;
  uploadPathPrefix: string;
  onUploadError: (message: string) => void;
  onChange: (value: string) => void;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blogBlockIndent: {
      increaseBlockIndent: () => ReturnType;
      decreaseBlockIndent: () => ReturnType;
    };
    blogHeadingIds: {
      ensureHeadingIds: () => ReturnType;
    };
  }
}

const BlogEditorAttributes = Extension.create({
  name: "blogEditorAttributes",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("id"),
            renderHTML: (attributes: Record<string, unknown>) => {
              const id = typeof attributes.id === "string" ? normalizeHeadingId(attributes.id) : "";
              return id && isValidHeadingId(id) ? { id } : {};
            },
          },
        },
      },
      {
        types: ["paragraph", "heading", "blockquote"],
        attributes: {
          indent: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              sanitizeIndentLevel(element.getAttribute("data-indent")),
            renderHTML: (attributes: Record<string, unknown>) => {
              const indent = sanitizeIndentLevel(
                typeof attributes.indent === "string" ? attributes.indent : null,
              );
              return indent ? { "data-indent": indent } : {};
            },
          },
        },
      },
    ];
  },
});

function addHeadingIdUpdates({ state, tr }: Pick<CommandProps, "state" | "tr">) {
  const usedIds = new Set<string>();
  const updates: Array<{ pos: number; id: string }> = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading" || ![2, 3].includes(node.attrs.level)) {
      return;
    }

    const existingId = typeof node.attrs.id === "string" ? normalizeHeadingId(node.attrs.id) : "";
    const textId = normalizeHeadingId(node.textContent) || "section";
    const preferredId = existingId && isValidHeadingId(existingId) ? existingId : textId;
    const nextId = getUniqueHeadingId(preferredId, usedIds);

    if (node.attrs.id !== nextId) {
      updates.push({ pos, id: nextId });
    }
  });

  updates.forEach(({ pos, id }) => {
    const node = tr.doc.nodeAt(pos);
    if (!node) return;

    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      id,
    });
  });
}

const BlogHeadingIds = Extension.create({
  name: "blogHeadingIds",

  addCommands() {
    return {
      ensureHeadingIds:
        () =>
        ({ state, tr, dispatch }: CommandProps) => {
          addHeadingIdUpdates({ state, tr });

          if (tr.docChanged) {
            dispatch?.(tr);
            return true;
          }

          return false;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions: readonly Transaction[], _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const transaction = newState.tr;
          addHeadingIdUpdates({ state: newState, tr: transaction });

          return transaction.docChanged ? transaction : null;
        },
      }),
    ];
  },
});

const BlogBlockIndent = Extension.create({
  name: "blogBlockIndent",

  addCommands() {
    const updateIndent =
      (direction: 1 | -1) =>
      ({ state, tr, dispatch }: CommandProps) => {
        const positions = new Map<number, { attrs: Record<string, unknown> }>();
        const allowedTypes = new Set(["paragraph", "heading", "blockquote"]);

        state.selection.ranges.forEach((range) => {
          state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node, pos) => {
            if (!allowedTypes.has(node.type.name)) {
              return true;
            }

            positions.set(pos, { attrs: node.attrs });
            return node.type.name !== "blockquote";
          });
        });

        if (positions.size === 0) {
          for (let depth = state.selection.$from.depth; depth > 0; depth -= 1) {
            const node = state.selection.$from.node(depth);
            if (!allowedTypes.has(node.type.name)) continue;

            positions.set(state.selection.$from.before(depth), { attrs: node.attrs });
            break;
          }
        }

        if (positions.size === 0) {
          return false;
        }

        positions.forEach(({ attrs }, pos) => {
          const currentLevel = Number.parseInt(String(attrs.indent ?? "0"), 10) || 0;
          const nextLevel = Math.max(0, Math.min(MAX_INDENT_LEVEL, currentLevel + direction));
          const node = tr.doc.nodeAt(pos);
          if (!node) return;

          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            indent: nextLevel === 0 ? null : String(nextLevel),
          });
        });

        if (tr.docChanged) {
          dispatch?.(tr);
          return true;
        }

        return false;
      };

    return {
      increaseBlockIndent: () => updateIndent(1),
      decreaseBlockIndent: () => updateIndent(-1),
    };
  },
});

const BlogImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          sanitizeImageWidth(element.getAttribute("width")),
        renderHTML: (attributes: Record<string, unknown>) => {
          const width = sanitizeImageWidth(
            typeof attributes.width === "string" ? attributes.width : null,
          );
          return width ? { width } : {};
        },
      },
    };
  },
});

function ToolbarButton({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "grid h-9 w-9 place-items-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[#6f4f40] bg-[#f7efe6] text-[#2f2a24]"
          : "border-[#e3d4c6] bg-white text-[#6f4f40] hover:bg-[#f7efe6] hover:text-[#2f2a24]",
      ].join(" ")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function RichTextEditor({
  label,
  value,
  placeholder,
  uploadPathPrefix,
  onUploadError,
  onChange,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const initialContentRef = useRef(contentToHtml(value));
  const lastEmittedHtmlRef = useRef("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const normalizedValue = contentToHtml(value);
  const editorExtensions = useMemo(
    () => [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: {
          levels: [2, 3],
        },
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
      UnderlineExtension,
      LinkExtension.configure({
        autolink: false,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {},
        isAllowedUri: (url) =>
          /^#[a-z0-9ก-๙][a-z0-9ก-๙-]{0,79}$/.test(url) ||
          /^https?:\/\//i.test(url) ||
          url.startsWith("mailto:"),
      }),
      BlogImage.configure({
        allowBase64: false,
      }),
      BlogEditorAttributes,
      BlogHeadingIds,
      BlogBlockIndent,
      PlaceholderExtension.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );
  const editorProps = useMemo(
    () => ({
      attributes: {
        class:
          "rich-content min-h-[18rem] px-4 py-3 text-sm leading-7 text-[#2f2a24] outline-none",
        "data-placeholder": placeholder,
      },
    }),
    [placeholder],
  );
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialContentRef.current,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps,
    onUpdate: ({ editor: updateEditor }) => {
      const html = updateEditor.isEmpty ? "" : updateEditor.getHTML();
      lastEmittedHtmlRef.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (normalizedValue === lastEmittedHtmlRef.current) return;
    if (editor.getHTML() === normalizedValue) return;

    editor.commands.setContent(normalizedValue, {
      emitUpdate: false,
    });
    editor.commands.ensureHeadingIds();
  }, [editor, normalizedValue]);

  useEffect(() => {
    editor?.commands.ensureHeadingIds();
  }, [editor]);

  const setExternalLink = () => {
    if (!editor) return;

    const previousHref = editor.getAttributes("link").href;
    const url = window.prompt(
      "Paste a link URL",
      typeof previousHref === "string" ? previousHref : "",
    );
    if (!url) return;

    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:")) {
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: url,
        target: "_blank",
        rel: "noreferrer",
      })
      .run();
  };

  const addJumpLink = () => {
    if (!editor) return;

    editor.commands.ensureHeadingIds();

    const headings: Array<{ id: string; label: string; level: number }> = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name !== "heading" || ![2, 3].includes(node.attrs.level)) {
        return;
      }

      const id = typeof node.attrs.id === "string" ? node.attrs.id : "";
      if (!id) return;

      headings.push({
        id,
        label: node.textContent.replace(/\s+/g, " ").trim() || id,
        level: node.attrs.level as number,
      });
    });

    if (headings.length === 0) {
      onUploadError("Add an H2 or H3 heading before creating a jump link.");
      return;
    }

    const answer = window.prompt(
      [
        "Choose a heading number:",
        ...headings.map(
          (heading, index) => `${index + 1}. H${heading.level} - ${heading.label}`,
        ),
      ].join("\n"),
    );
    if (!answer) return;

    const targetHeading = headings[Number.parseInt(answer, 10) - 1];
    if (!targetHeading) {
      onUploadError("Choose a valid heading number.");
      return;
    }

    const href = `#${targetHeading.id}`;
    const chain = editor.chain().focus();

    if (editor.state.selection.empty) {
      chain
        .insertContent({
          type: "text",
          text: targetHeading.label,
          marks: [
            {
              type: "link",
              attrs: {
                href,
                target: null,
                rel: null,
              },
            },
          ],
        })
        .run();
      return;
    }

    chain
      .extendMarkRange("link")
      .setLink({
        href,
        target: null,
        rel: null,
      })
      .run();
  };

  const increaseIndent = () => {
    if (!editor) return;

    if (editor.isActive("listItem") && editor.can().sinkListItem("listItem")) {
      editor.chain().focus().sinkListItem("listItem").run();
      return;
    }

    editor.chain().focus().increaseBlockIndent().run();
  };

  const decreaseIndent = () => {
    if (!editor) return;

    if (editor.isActive("listItem") && editor.can().liftListItem("listItem")) {
      editor.chain().focus().liftListItem("listItem").run();
      return;
    }

    editor.chain().focus().decreaseBlockIndent().run();
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file || !editor) return;

    if (!file.type.startsWith("image/")) {
      onUploadError("Please choose an image file.");
      return;
    }

    setUploadingImage(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safePrefix = uploadPathPrefix || "blog/inline";
    const filePath = `${safePrefix}/content-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(CONTENT_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      onUploadError(uploadError.message);
      setUploadingImage(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(CONTENT_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    editor
      .chain()
      .focus()
      .setImage({
        src: publicUrlData.publicUrl,
        alt: file.name,
        width: 640,
      })
      .run();
    setUploadingImage(false);
  };

  const updateSelectedImageWidth = (value: string) => {
    if (!editor || !editor.isActive("image")) return;

    const imagePosition = editor.state.selection.from;

    editor
      .chain()
      .focus()
      .updateAttributes("image", {
        width: value === "full" ? null : value,
      })
      .setNodeSelection(imagePosition)
      .run();
  };

  const selectedImageWidth = editor?.isActive("image")
    ? sanitizeImageWidth(editor.getAttributes("image").width) ?? "full"
    : null;

  return (
    <div className="grid gap-1 text-sm text-[#7b6d5f]">
      <span>{label}</span>
      <div className="overflow-hidden rounded-2xl border border-[#e3d4c6] bg-white">
        <div className="flex flex-wrap gap-1 border-b border-[#e3d4c6] bg-[#fbf7f1] p-2">
          <ToolbarButton
            label="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={Boolean(editor?.isActive("bold"))}
            disabled={!editor}
          >
            <Bold size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={Boolean(editor?.isActive("italic"))}
            disabled={!editor}
          >
            <Italic size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            active={Boolean(editor?.isActive("underline"))}
            disabled={!editor}
          >
            <Underline size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={Boolean(editor?.isActive("heading", { level: 2 }))}
            disabled={!editor}
          >
            <Heading2 size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            active={Boolean(editor?.isActive("heading", { level: 3 }))}
            disabled={!editor}
          >
            <Heading3 size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Paragraph"
            onClick={() => editor?.chain().focus().setParagraph().run()}
            active={Boolean(editor?.isActive("paragraph"))}
            disabled={!editor}
          >
            <Pilcrow size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Quote"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            active={Boolean(editor?.isActive("blockquote"))}
            disabled={!editor}
          >
            <Quote size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Bulleted list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={Boolean(editor?.isActive("bulletList"))}
            disabled={!editor}
          >
            <List size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            active={Boolean(editor?.isActive("orderedList"))}
            disabled={!editor}
          >
            <ListOrdered size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Increase indent" onClick={increaseIndent} disabled={!editor}>
            <IndentIncrease size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Decrease indent" onClick={decreaseIndent} disabled={!editor}>
            <IndentDecrease size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            onClick={setExternalLink}
            active={Boolean(editor?.isActive("link"))}
            disabled={!editor}
          >
            <LinkIcon size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton label="Jump link" onClick={addJumpLink} disabled={!editor}>
            <Anchor size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label={uploadingImage ? "Uploading image" : "Insert image"}
            onClick={() => imageInputRef.current?.click()}
            disabled={!editor || uploadingImage}
          >
            <ImageUp size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor || !editor.can().undo()}
          >
            <Undo2 size={16} strokeWidth={2} />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor || !editor.can().redo()}
          >
            <Redo2 size={16} strokeWidth={2} />
          </ToolbarButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>
        {editor ? (
          <BubbleMenu
            editor={editor}
            pluginKey="blog-image-width-menu"
            updateDelay={0}
            shouldShow={shouldShowImageBubbleMenu}
            options={IMAGE_BUBBLE_MENU_OPTIONS}
            className="z-50 flex items-center gap-1 rounded-2xl border border-[#e3d4c6] bg-white p-1 text-xs text-[#7b6d5f] shadow-[0_12px_30px_rgba(65,43,27,0.14)]"
          >
            {IMAGE_WIDTH_CHOICES.map((width) => {
              const isActive = selectedImageWidth === width;
              const label = width === "full" ? "Full" : width;

              return (
                <button
                  key={width}
                  type="button"
                  className={[
                    "h-8 rounded-xl px-2.5 font-medium transition-colors",
                    isActive
                      ? "bg-[#6f4f40] text-white"
                      : "text-[#6f4f40] hover:bg-[#f7efe6] hover:text-[#2f2a24]",
                  ].join(" ")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateSelectedImageWidth(width)}
                  aria-pressed={isActive}
                >
                  {label}
                </button>
              );
            })}
          </BubbleMenu>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

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

function getStorageObjectPathsFromContent(value: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const template = document.createElement("template");
  template.innerHTML = contentToHtml(value);

  return Array.from(template.content.querySelectorAll<HTMLImageElement>("img"))
    .map((image) => getStorageObjectPath(image.src))
    .filter((path): path is string => Boolean(path));
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
  const inlineImagePathPrefix = `blog/${
    form.slug.trim() || slugify(previewTitle) || "untitled"
  }`;
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
      isBlankContent(form.content_th) ? "Thai content" : "",
      isBlankContent(form.content_en) ? "English content" : "",
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
      content_th: sanitizeRichContent(form.content_th),
      content_en: sanitizeRichContent(form.content_en),
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

    [
      ...getStorageObjectPathsFromContent(deleteTarget.content_th),
      ...getStorageObjectPathsFromContent(deleteTarget.content_en),
    ].forEach((path) => storageObjectPaths.add(path));

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

                <RichTextEditor
                  key={activeLanguage}
                  label={activeLanguage === "th" ? "Content TH" : "Content EN"}
                  value={activeLanguage === "th" ? form.content_th : form.content_en}
                  uploadPathPrefix={inlineImagePathPrefix}
                  onUploadError={(message) =>
                    setSaveNotice({
                      type: "error",
                      message,
                    })
                  }
                  onChange={(value) =>
                    handleFieldChange(
                      activeLanguage === "th" ? "content_th" : "content_en",
                      value,
                    )
                  }
                  placeholder={
                    activeLanguage === "th"
                      ? "พิมพ์เนื้อหาภาษาไทย"
                      : "Write the English content"
                  }
                />
                <input
                  type="hidden"
                  value={activeLanguage === "th" ? form.content_th : form.content_en}
                  required
                  readOnly
                />

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
                    <div
                      className="rich-content grid gap-2.5 text-sm leading-7 text-[#2f2a24]"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichContent(
                          activeLanguage === "th" ? form.content_th : form.content_en,
                        ),
                      }}
                    />

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
