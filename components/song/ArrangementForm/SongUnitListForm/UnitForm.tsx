import { parseChordPro } from "@/chopro/music";
import { MarkdownUnitForm } from "@/components/common/MarkdownUnitForm";
import TextInput from "@/components/common/TextInput";
import ChordProViewer from "@/components/song/ChordProViewer";
import { unitColorClasses } from "@/components/song/unit-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientSongUnit, SongUnitType } from "@/prisma/models";
import { SONG_UNIT_TYPES } from "@/prisma/models";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CopyIcon,
  MessageSquareIcon,
  MoreVertical,
  Repeat2,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useInstructionToolbar } from ".";

type UnitFormProps = {
  unit: ClientSongUnit;
  removeUnit: () => void;
  duplicateUnit: () => void;
  insertBefore: () => void;
  insertAfter: () => void;
  onChangeUnit: (unit: ClientSongUnit) => void;
  className?: string;
};

export default function UnitForm({
  unit,
  removeUnit,
  duplicateUnit,
  insertBefore,
  insertAfter,
  onChangeUnit,
  className,
}: UnitFormProps) {
  const t = useTranslations();

  const colorClasses = unitColorClasses[unit.type];
  const contentId = useId();
  const [notesExpanded, setNotesExpanded] = useState(!!unit.notes);
  const [collapsed, setCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertRef = useRef<(text: string) => void>(() => {});

  // Atualiza ref a cada render para capturar unit/onChangeUnit frescos
  insertRef.current = (tag: string) => {
    const textarea = textareaRef.current;
    const pos = textarea ? textarea.selectionStart : unit.content.length;
    const newContent = unit.content.slice(0, pos) + tag + unit.content.slice(pos);
    onChangeUnit({ ...unit, content: newContent });
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(pos + tag.length, pos + tag.length);
    }, 0);
  };

  const { setActiveInsert } = useInstructionToolbar();
  const stableInsert = useCallback((text: string) => insertRef.current(text), []);
  const handleTextareaFocus = useCallback(
    () => setActiveInsert(stableInsert),
    [setActiveInsert, stableInsert]
  );

  useEffect(() => {
    return () => setActiveInsert(null);
  }, [setActiveInsert]);

  const handleChangeUnitType = useCallback(
    (newValue: string) => {
      onChangeUnit({ ...unit, type: newValue as SongUnitType });
    },
    [onChangeUnit, unit]
  );

  const handleChangeChordpro = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChangeUnit({ ...unit, content: event.target.value });
    },
    [onChangeUnit, unit]
  );

  const isTextUnit = unit.type === "TEXT";
  const { hasError } = useMemo(() => {
    if (isTextUnit) return { hasError: false };
    try {
      parseChordPro(unit.content);
      return { hasError: false };
    } catch {
      return { hasError: true };
    }
  }, [unit.content, isTextUnit]);

  const handleMarkdownChange = useCallback(
    (content: string) => {
      onChangeUnit({ ...unit, content });
    },
    [onChangeUnit, unit]
  );

  const handleChangeNotes = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChangeUnit({ ...unit, notes: event.target.value || null });
    },
    [onChangeUnit, unit]
  );

  const handleClearNotes = useCallback(() => {
    onChangeUnit({ ...unit, notes: null });
    setNotesExpanded(false);
  }, [onChangeUnit, unit]);

  const handleRepeatClick = useCallback(() => {
    const current = unit.repeatCount ?? 1;
    const next = current >= 4 ? 1 : current + 1;
    onChangeUnit({ ...unit, repeatCount: next });
  }, [onChangeUnit, unit]);

  return (
    <div
      className={`border ${colorClasses.border} ${colorClasses.background} rounded-lg p-2 md:p-4 mb-2 ${className || ""}`}
    >
      {/* Header: tipo | notas | ⋮ */}
      <div className={`flex items-center gap-2 ${collapsed ? "" : "mb-2"}`}>
        <TypeDropdown value={unit.type} onChange={handleChangeUnitType} />

        {notesExpanded ? (
          <div
            className={`inline-flex items-center gap-1 rounded px-2 py-1 border ${colorClasses.border} bg-white`}
          >
            <MessageSquareIcon
              size={11}
              className={`shrink-0 ${colorClasses.text}`}
            />
            <span className="relative inline-flex items-center min-w-[4rem]">
              {/* span oculto determina a largura conforme o texto */}
              <span
                className="invisible whitespace-pre text-xs pointer-events-none"
                aria-hidden
              >
                {unit.notes || t("UnitData.notesPlaceholder")}
              </span>
              <input
                type="text"
                className={`absolute inset-0 w-full bg-transparent text-xs outline-none ${colorClasses.text} placeholder:opacity-50`}
                value={unit.notes ?? ""}
                onChange={handleChangeNotes}
                placeholder={t("UnitData.notesPlaceholder")}
              />
            </span>
            <button
              type="button"
              onClick={handleClearNotes}
              className={`shrink-0 ${colorClasses.text} opacity-60 hover:opacity-100`}
            >
              <XIcon size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNotesExpanded(true)}
            className={`text-xs px-2 py-1 rounded border border-dashed ${colorClasses.border} flex items-center gap-1 ${colorClasses.text} hover:opacity-80 transition-opacity cursor-pointer`}
          >
            <MessageSquareIcon size={11} />
            <span className="hidden sm:inline">{t("UnitData.addNotes")}</span>
          </button>
        )}
        <div className="flex-1" />

        <button
          type="button"
          onClick={handleRepeatClick}
          title="Repetir bloco"
          className={`flex items-center gap-0.5 p-1 rounded transition-colors shrink-0 ${
            (unit.repeatCount ?? 1) > 1
              ? colorClasses.text
              : "text-zinc-300 hover:text-zinc-400"
          }`}
        >
          <Repeat2 size={14} />
          {(unit.repeatCount ?? 1) > 1 && (
            <span className="text-xs font-semibold leading-none">×{unit.repeatCount}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors shrink-0"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors shrink-0"
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={insertBefore}
              className="text-xs cursor-pointer"
            >
              <ArrowUp size={13} className="mr-1.5" />
              Inserir acima
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={insertAfter}
              className="text-xs cursor-pointer"
            >
              <ArrowDown size={13} className="mr-1.5" />
              Inserir abaixo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={duplicateUnit}
              className="text-xs cursor-pointer"
            >
              <CopyIcon size={13} className="mr-1.5" />
              {t("Messages.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={removeUnit}
              className="text-xs cursor-pointer text-red-600 focus:text-red-600"
            >
              <TrashIcon size={13} className="mr-1.5" />
              {t("Messages.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (isTextUnit ? (
        <div className="mt-4">
          <MarkdownUnitForm
            initialContent={unit.content}
            onChange={handleMarkdownChange}
          />
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-2 gap-4 flex flex-col mt-4">
          <div className="lg:flex lg:flex-col" onFocus={handleTextareaFocus}>
            <TextInput
              ref={textareaRef}
              id={contentId}
              className="resize-none lg:flex-1 bg-white font-mono"
              placeholder={t("UnitData.contentPlaceholder")}
              onChange={handleChangeChordpro}
              value={unit.content}
              minRows={1}
              long
            />
          </div>
          <div
            className="rounded-md bg-black/5 px-2 py-2"
            style={{
              "--item-mb": "0.5em",
              "--block-px": "0",
              "--block-pt": "0",
            } as React.CSSProperties}
          >
            {hasError ? (
              <p className="text-red-500 text-sm">
                {t("Messages.invalidChordPro")}
              </p>
            ) : (
              <ChordProViewer
                chordpro={unit.content}
                density="compact"
                commentClass={colorClasses.comment}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── TypeDropdown ─────────────────────────────────────────────────────────── */

type TypeDropdownProps = {
  value: SongUnitType;
  onChange: (value: SongUnitType) => void;
};

function TypeDropdown({ value, onChange }: TypeDropdownProps) {
  const t = useTranslations();
  const colorClasses = unitColorClasses[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm font-medium shrink-0 bg-white border border-zinc-200 shadow-xs text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colorClasses.circleBackground}`} />
          {t(`UnitTypes.${value}`)}
          <ChevronDown size={10} className="text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-fit">
        {SONG_UNIT_TYPES.map((type) => {
          const cc = unitColorClasses[type];
          return (
            <DropdownMenuItem
              key={type}
              onClick={() => onChange(type)}
              className="text-xs cursor-pointer gap-2"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${cc.circleBackground}`}
              />
              {t(`UnitTypes.${type}`)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
