"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Redo2,
  Undo2,
} from "lucide-react";
import { clsx } from "clsx";

interface RichTextEditorProps {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * A deliberately small rich-text editor: contentEditable + document.execCommand.
 * execCommand is deprecated but still broadly supported and is the right tool for a
 * scoped feature like this — pulling in a full editor framework (Slate/Lexical/TipTap)
 * for "bold/italic/list/quote" would be a lot of dependency weight for this surface.
 * Output is HTML, which is exactly what the backend's Nodemailer `html` field expects.
 */
export function RichTextEditor({ html, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Only push the `html` prop into the DOM when it changes for a reason other than this
  // editor's own onInput (e.g. external reset). Re-applying innerHTML on every keystroke —
  // even to an equivalent string — resets the cursor to the start of the contentEditable
  // div, which makes each new character appear before the ones already typed.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [html]);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }

  return (
    <div className="rounded-lg border border-ink-200">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={clsx(
          "rte-content min-h-[220px] px-4 py-3 text-sm text-ink-900 outline-none",
          "empty:before:pointer-events-none empty:before:text-ink-500 empty:before:content-[attr(data-placeholder)]",
        )}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      />
      <div className="flex items-center gap-1 border-t border-ink-200 px-3 py-2">
        <ToolbarButton icon={<Undo2 size={14} />} onClick={() => exec("undo")} label="Undo" />
        <ToolbarButton icon={<Redo2 size={14} />} onClick={() => exec("redo")} label="Redo" />
        <Divider />
        <ToolbarButton icon={<Bold size={14} />} onClick={() => exec("bold")} label="Bold" />
        <ToolbarButton icon={<Italic size={14} />} onClick={() => exec("italic")} label="Italic" />
        <ToolbarButton icon={<Underline size={14} />} onClick={() => exec("underline")} label="Underline" />
        <Divider />
        <ToolbarButton icon={<List size={14} />} onClick={() => exec("insertUnorderedList")} label="Bullet list" />
        <ToolbarButton icon={<ListOrdered size={14} />} onClick={() => exec("insertOrderedList")} label="Numbered list" />
        <ToolbarButton icon={<Quote size={14} />} onClick={() => exec("formatBlock", "blockquote")} label="Quote" />
        <ToolbarButton icon={<Strikethrough size={14} />} onClick={() => exec("strikeThrough")} label="Strikethrough" />
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-ink-200" />;
}
