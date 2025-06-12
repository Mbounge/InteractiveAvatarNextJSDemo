"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Editor,
  EditorContent,
  BubbleMenu,
  ChainedCommands,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import { marked } from "marked";
import { Toaster, toast } from "react-hot-toast";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Extension, InputRule } from "@tiptap/core";
import { Heading, Level } from "@tiptap/extension-heading";
import { CellSelection } from "prosemirror-tables";
import {
  Upload,
  Sparkles,
  Bold,
  Italic,
  List,
  ListOrdered,
  Save,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Code,
  Table as TableIcon,
  Trash2,
  Plus,
  Minus,
  Merge,
  Split,
  ChevronDown,
  Menu,
  X,
  FileDown,
  FileText,
  PanelLeftClose,
  PanelRightClose,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Image from "next/image";
import logo2 from "../../public/Graet_Logo.svg";

// --- HELPER HOOK & FUNCTIONS ---

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

const getErrorMessage = async (response: Response): Promise<string> => {
  const clonedResponse = response.clone();
  try {
    const errorJson = await clonedResponse.json();
    return errorJson.error?.message || JSON.stringify(errorJson);
  } catch (e) {
    return await response.text() || `HTTP error! Status: ${response.status}`;
  }
};

// --- TIPTAP CONFIGURATION (No changes here) ---
const PREDEFINED_SIZES: { [key: string]: string } = {
  p: "12pt",
  h1: "24pt",
  h2: "18pt",
  h3: "16pt",
};
type FontSizeOptions = { types: string[] };
const editorExtensions = [
  StarterKit.configure({ heading: false, blockquote: false }),
  Heading.configure({ levels: [1, 2, 3] }).extend({
    addInputRules() {
      return this.options.levels.map((level: Level) => {
        return new InputRule({
          find: new RegExp(`^(#{1,${level}})\\s$`),
          handler: ({ state, range }) => {
            const { tr } = state;
            const size = PREDEFINED_SIZES[`h${level}`];
            tr.delete(range.from, range.to).setBlockType(
              range.from,
              range.from,
              this.type,
              { level }
            );
            if (size) {
              tr.addStoredMark(
                state.schema.marks.textStyle.create({ fontSize: size })
              );
            }
          },
        });
      });
    },
  }),
  Underline,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Extension.create<FontSizeOptions>({
    name: "fontSize",
    addOptions() {
      return { types: ["textStyle"] };
    },
    addGlobalAttributes() {
      return [
        {
          types: this.options.types,
          attributes: {
            fontSize: {
              default: null,
              parseHTML: (e) => e.style.fontSize.replace(/['"]+/g, ""),
              renderHTML: (attrs) =>
                attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
            },
          },
        },
      ];
    },
    //@ts-ignore
    addCommands() {
      return {
        setFontSize:
          (size: string) =>
          ({ chain }: { chain: ChainedCommands }) => {
            //@ts-ignore
            return chain().setMark("textStyle", { fontSize: size }).run();
          },
        unsetFontSize:
          () =>
          ({ chain }: { chain: ChainedCommands }) => {
            //@ts-ignore
            return chain()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run();
          },
      };
    },
  }),
  Link.configure({ openOnClick: false, autolink: true }),
  Extension.create({
    name: "resetMarksOnEnter",
    addKeyboardShortcuts() {
      return {
        Enter: () =>
          this.editor.isActive("heading")
            ? this.editor.commands.splitBlock({ keepMarks: false })
            : false,
      };
    },
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

// --- HELPER COMPONENTS (No changes here) ---
type ToolbarButtonProps = {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
};
const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  isActive,
  disabled,
  children,
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`p-2 rounded-md transition-colors ${isActive ? "bg-gray-300" : "hover:bg-gray-200"} disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);
type DropdownOption = { label: string; value: string };
type CustomDropdownProps = {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  title: string;
};
const CustomDropdown: React.FC<CustomDropdownProps> = React.memo(
  ({ options, value, onChange, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedLabel =
      options.find((opt) => opt.value === value)?.label || value;
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);
    return (
      <div ref={dropdownRef} className="relative" title={title}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-32 p-2 border border-gray-300 bg-white rounded-md text-sm hover:bg-gray-50"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-4 h-4 ml-2 text-gray-500" />
        </button>
        {isOpen && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${value === option.value ? "font-bold bg-gray-100" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
CustomDropdown.displayName = "CustomDropdown";
const TableCreationGrid: React.FC<{ editor: Editor; close: () => void }> = ({
  editor,
  close,
}) => {
  const [hovered, setHovered] = useState({ rows: 0, cols: 0 });
  const createTable = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    close();
  };
  return (
    <div className="absolute z-10 bg-white shadow-lg border rounded-md p-2 mt-1">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex">
          {Array.from({ length: 5 }).map((_, colIndex) => (
            <div
              key={colIndex}
              onMouseOver={() =>
                setHovered({ rows: rowIndex + 1, cols: colIndex + 1 })
              }
              onClick={() => createTable(rowIndex + 1, colIndex + 1)}
              className={`w-6 h-6 border border-gray-300 cursor-pointer ${rowIndex < hovered.rows && colIndex < hovered.cols ? "bg-blue-300" : "bg-white"}`}
            />
          ))}
        </div>
      ))}
      <div className="text-center text-sm mt-1">
        {hovered.rows} x {hovered.cols}
      </div>
    </div>
  );
};
const TableMenus: React.FC<{ editor: Editor }> = ({ editor }) => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  type MenuItemProps = {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  };
  const MenuItem: React.FC<MenuItemProps> = ({
    onClick,
    disabled,
    children,
  }) => (
    <button
      onClick={() => {
        onClick();
        setDropdownOpen(false);
      }}
      disabled={disabled}
      className="flex items-center w-full text-left p-2 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);
  return (
    <>
      <BubbleMenu
        pluginKey="tableMain"
        editor={editor}
        shouldShow={({ editor }) =>
          editor.isActive("table") &&
          !(editor.state.selection instanceof CellSelection)
        }
        tippyOptions={{
          getReferenceClientRect: () => {
            const { view } = editor;
            const { $anchor } = editor.state.selection;
            const element = view.domAtPos($anchor.pos).node as HTMLElement;
            const tableElement = element.closest("table");
            if (!tableElement) {
              return new DOMRect(0, 0, 0, 0);
            }
            return tableElement.getBoundingClientRect();
          },
          placement: "top-start",
          offset: [0, 8],
        }}
      >
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className="bg-white text-gray-700 p-1.5 rounded-md shadow-md border border-gray-300 hover:bg-gray-100"
            title="Table options"
          >
            <TableIcon className="w-4 h-4" />
          </button>
          {isDropdownOpen && (
            <div className="absolute z-10 top-full mt-2 bg-white text-black p-2 rounded-lg shadow-xl border border-gray-200 w-max">
              <div className="flex divide-x divide-gray-200">
                <div className="px-3 py-1">
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    Row
                  </div>
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Above
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Below
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteRow().run()}
                  >
                    <Minus className="w-4 h-4 mr-2" /> Delete Row
                  </MenuItem>
                </div>
                <div className="px-3 py-1">
                  <div className="font-bold text-xs uppercase text-gray-500 pb-2">
                    Column
                  </div>
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnBefore().run()
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Left
                  </MenuItem>
                  <MenuItem
                    onClick={() =>
                      editor.chain().focus().addColumnAfter().run()
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Right
                  </MenuItem>
                  <MenuItem
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                  >
                    <Minus className="w-4 h-4 mr-2" /> Delete Column
                  </MenuItem>
                </div>
              </div>
              <hr className="my-2" />
              <div className="px-1">
                <MenuItem
                  onClick={() => editor.chain().focus().deleteTable().run()}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                  <span className="text-red-500">Delete Table</span>
                </MenuItem>
              </div>
            </div>
          )}
        </div>
      </BubbleMenu>
      <BubbleMenu
        pluginKey="tableCellSelection"
        editor={editor}
        shouldShow={({ editor }) =>
          editor.state.selection instanceof CellSelection
        }
        tippyOptions={{ placement: "top" }}
        className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
      >
        <button
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!editor.can().mergeCells()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Merge cells"
        >
          <Merge className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!editor.can().splitCell()}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-40"
          title="Split cell"
        >
          <Split className="w-4 h-4" />
        </button>
      </BubbleMenu>
    </>
  );
};
const useToolbarState = (editor: Editor | null) => {
  const [state, setState] = useState({
    currentStyle: "p",
    currentFontSize: "12pt",
    isBold: false,
    isItalic: false,
    isUnderline: false,
    textAlign: "left",
    isBulletList: false,
    isOrderedList: false,
    isCodeBlock: false,
    canUndo: false,
    canRedo: false,
  });
  useEffect(() => {
    if (!editor) return;
    const updateState = () => {
      const newStyle = editor.isActive("heading", { level: 1 })
        ? "h1"
        : editor.isActive("heading", { level: 2 })
          ? "h2"
          : editor.isActive("heading", { level: 3 })
            ? "h3"
            : "p";
      setState({
        currentStyle: newStyle,
        currentFontSize:
          editor.getAttributes("textStyle").fontSize ||
          PREDEFINED_SIZES[newStyle],
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isUnderline: editor.isActive("underline"),
        textAlign: editor.isActive({ textAlign: "center" })
          ? "center"
          : editor.isActive({ textAlign: "right" })
            ? "right"
            : editor.isActive({ textAlign: "justify" })
              ? "justify"
              : "left",
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        isCodeBlock: editor.isActive("codeBlock"),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      });
    };
    editor.on("transaction", updateState);
    editor.on("selectionUpdate", updateState);
    updateState();
    return () => {
      editor.off("transaction", updateState);
      editor.off("selectionUpdate", updateState);
    };
  }, [editor]);
  return state;
};

const EditorToolbar: React.FC<{
  editor: Editor | null;
  isMobileSidebarOpen: boolean;
  isDesktopSidebarCollapsed: boolean;
  onToggleMobileSidebar: () => void;
  onToggleDesktopSidebar: () => void;
}> = ({
  editor,
  isMobileSidebarOpen,
  isDesktopSidebarCollapsed,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
}) => {
  const [isTableDropdownOpen, setTableDropdownOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const toolbarState = useToolbarState(editor);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableMenuRef.current &&
        !tableMenuRef.current.contains(event.target as Node)
      ) {
        setTableDropdownOpen(false);
      }
    };
    if (isTableDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTableDropdownOpen]);

  const handleStyleChange = useCallback(
    (style: string) => {
      if (!editor) return;
      const defaultSize = PREDEFINED_SIZES[style];
      const chain = editor.chain().focus();
      if (style === "p") {
        chain.setParagraph();
      } else {
        chain.setHeading({
          level: parseInt(style.replace("h", ""), 10) as 1 | 2 | 3,
        });
      }
      //@ts-ignore
      chain.setFontSize(defaultSize).run();
    },
    [editor]
  );

  const handleFontSizeChange = useCallback(
    (size: string) => {
      if (!editor) return;
      //@ts-ignore
      editor.chain().focus().setFontSize(size).run();
    },
    [editor]
  );

  if (!editor) return null;

  const styleOptions: DropdownOption[] = [
    { label: "Paragraph", value: "p" },
    { label: "Heading 1", value: "h1" },
    { label: "Heading 2", value: "h2" },
    { label: "Heading 3", value: "h3" },
  ];
  const fontSizeOptions: DropdownOption[] = [
    { label: "10pt", value: "10pt" },
    { label: "12pt", value: "12pt" },
    { label: "14pt", value: "14pt" },
    { label: "16pt", value: "16pt" },
    { label: "18pt", value: "18pt" },
    { label: "24pt", value: "24pt" },
    { label: "30pt", value: "30pt" },
  ];

  const handleToggleClick = () => {
    if (isDesktop) {
      onToggleDesktopSidebar();
    } else {
      onToggleMobileSidebar();
    }
  };

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 p-2 flex items-center space-x-1 flex-wrap">
      <div className="flex items-center space-x-1">
        <ToolbarButton onClick={handleToggleClick} title="Toggle Sidebar">
          {isDesktop ? (
            isDesktopSidebarCollapsed ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )
          ) : isMobileSidebarOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </ToolbarButton>
      </div>
      <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!toolbarState.canUndo}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!toolbarState.canRedo}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <div className="flex items-center space-x-2 border-l border-gray-300 pl-2 ml-2">
        <CustomDropdown
          options={styleOptions}
          value={toolbarState.currentStyle}
          onChange={handleStyleChange}
          title="Text Style"
        />
        <CustomDropdown
          options={fontSizeOptions}
          value={toolbarState.currentFontSize}
          onChange={handleFontSizeChange}
          title="Font Size"
        />
      </div>
      <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={toolbarState.isBold}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={toolbarState.isItalic}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={toolbarState.isUnderline}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={toolbarState.textAlign === "left"}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={toolbarState.textAlign === "center"}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={toolbarState.textAlign === "right"}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={toolbarState.textAlign === "justify"}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <div className="flex items-center space-x-1 border-l border-gray-300 pl-2 ml-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={toolbarState.isBulletList}
          title="Bulleted List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={toolbarState.isOrderedList}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={toolbarState.isCodeBlock}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <div ref={tableMenuRef} className="relative">
          <ToolbarButton
            onClick={() => setTableDropdownOpen(!isTableDropdownOpen)}
            title="Insert Table"
          >
            <TableIcon className="w-4 h-4" />
          </ToolbarButton>
          {isTableDropdownOpen && (
            <TableCreationGrid
              editor={editor}
              close={() => setTableDropdownOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const EditorPlaceholder = ({ onStart }: { onStart: () => void }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center bg-gray-50 bg-opacity-80 backdrop-blur-sm p-4">
    <Upload className="w-16 h-16 text-gray-400 mb-4" />
    <h3 className="text-lg font-semibold text-gray-600">Ready for Scouting</h3>
    <p className="text-gray-500 max-w-sm">
      Upload an audio file to generate your first report.
    </p>
    <button
      onClick={onStart}
      className="mt-6 lg:hidden flex items-center justify-center space-x-2 py-3 px-6 bg-[#0e0c66] text-white font-semibold rounded-lg hover:bg-[#0e0c66]/85 transition-all duration-200"
    >
      <Sparkles className="w-5 h-5" />
      <span>Start New Report</span>
    </button>
  </div>
);

const ScoutingPlatformPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptionText, setTranscriptionText] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const initEditor = useCallback(
    (content: any) => {
      if (editor) {
        editor.destroy();
      }
      const newEditor = new Editor({
        extensions: editorExtensions,
        content: content,
        editorProps: {
          attributes: { class: "prose max-w-none p-4 md:p-8 focus:outline-none" },
        },
        onCreate: ({ editor: createdEditor }) => {
          const { tr, doc } = createdEditor.state;
          let modified = false;
          doc.descendants((node, pos) => {
            if (!node.isTextblock) return;
            let size: string | undefined = undefined;
            if (node.type.name === "heading") {
              const level = node.attrs.level;
              size = PREDEFINED_SIZES[`h${level}`];
            } else if (node.type.name === "paragraph") {
              size = PREDEFINED_SIZES.p;
            }
            if (size) {
              const from = pos + 1;
              const to = from + node.content.size;
              tr.addMark(
                from,
                to,
                createdEditor.schema.marks.textStyle.create({ fontSize: size })
              );
              modified = true;
            }
          });
          if (modified) {
            createdEditor.view.dispatch(tr);
          }
        },
      });
      setEditor(newEditor);
    },
    [editor]
  );

  useEffect(() => {
    const initialContent = marked.parse(
      "## Welcome\n\nUpload an audio file to get started."
    ) as string;
    initEditor(initialContent);
    return () => {
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExportMenuOpen]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check for valid audio type
      if (!file.type.startsWith("audio/")) {
        toast.error("Invalid file type. Please select an audio file.");
        event.target.value = "";
        return;
      }
      
      // --- NEW: Enforce the 20MB file size limit ---
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 20) {
        toast.error(`File exceeds 20MB limit. Your file is ${fileSizeMB.toFixed(2)}MB.`);
        event.target.value = "";
        return;
      }

      setSelectedFile(file);
      setTranscriptionText("");
      toast.success(`${file.name} selected!`);
    }
  };

  const handleProcessAudio = async () => {
    if (!selectedFile) {
      toast.error("Please select an audio file first.");
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        toast.error("API Key is not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY.");
        return;
    }

    setIsTranscribing(true);
    toast.loading("Transcribing audio...", { id: "process-toast" });

    let transcriptionResult = "";
    try {
        const audioBuffer = await selectedFile.arrayBuffer();
        const audioBase64 = arrayBufferToBase64(audioBuffer);

        const requestBody = {
            contents: [{
                parts: [
                    {
                        "inline_data": {
                            "mime_type": selectedFile.type,
                            "data": audioBase64
                        }
                    },
                    { "text": "Transcribe the following audio of a sports scout. Focus on clarity and accuracy." }
                ]
            }]
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const transcribeResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!transcribeResponse.ok) {
            const errorMsg = await getErrorMessage(transcribeResponse);
            throw new Error(errorMsg);
        }

        const responseData = await transcribeResponse.json();
        
        if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
            transcriptionResult = responseData.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Could not find transcription in API response.");
        }
        
        setTranscriptionText(transcriptionResult);
        toast.success("Transcription complete!", { id: "process-toast" });

    } catch (error: any) {
        console.error("Direct API Error:", error);
        toast.error(`Could not transcribe: ${error.message}`, { id: "process-toast" });
        setIsTranscribing(false);
        return;
    }

    setIsGenerating(true);
    toast.loading("Generating scout report...", { id: "generate-toast" });
    try {
      const generateResponse = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription: transcriptionResult }),
      });

      if (!generateResponse.ok) {
        const errorMsg = await getErrorMessage(generateResponse);
        throw new Error(errorMsg);
      }

      const data = await generateResponse.json();
      const finalHtml = marked.parse(data.report) as string;
      initEditor(finalHtml);
      setHasGeneratedReport(true);
      if (window.innerWidth < 1024) {
        setIsMobileSidebarOpen(false);
      }
      toast.success("Report generated!", { id: "generate-toast" });
    } catch (error: any) {
      console.error("Report Generation API Error:", error);
      toast.error(`Could not generate report: ${error.message}`, { id: "generate-toast" });
    } finally {
      setIsTranscribing(false);
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "txt") => {
    if (!editor) return;
    setIsExportMenuOpen(false);

    const reportTitle =
      editor.state.doc.firstChild?.textContent || "Scouting Report";
    const fileName =
      `${reportTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.` + format;

    const downloadFile = (blob: Blob, name: string) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    };

    if (format === "txt") {
      toast.loading("Exporting as TXT...", { id: "export-toast" });
      const textContent = editor.getText();
      const blob = new Blob([textContent], { type: "text/plain" });
      downloadFile(blob, fileName);
      toast.success("Exported as TXT!", { id: "export-toast" });
      return;
    }

    if (format === "pdf") {
      const printStyles = `
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          @media print {
            body {
              font-family: sans-serif;
              line-height: 1.5;
              color: #333;
            }
            h1, h2, h3, p, ul, ol, blockquote, table { page-break-inside: avoid; }
            h1, h2 { page-break-before: auto; page-break-after: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 11pt; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
          }
        </style>
      `;

      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const printContent = `
        <html>
          <head>
            <title>${reportTitle}</title>
            ${printStyles}
          </head>
          <body>
            <div style="text-align: center; margin-bottom: 2rem; page-break-inside: avoid;">
              <img src="${logo2.src}" style="width: 120px; height: auto;" alt="Logo">
            </div>
            ${editor.getHTML()}
          </body>
        </html>
      `;

      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
      }
    }
  };

  const isLoading = isTranscribing || isGenerating;
  const buttonText = isTranscribing
    ? "Transcribing..."
    : isGenerating
      ? "Generating..."
      : "Generate Report";

  return (
    <div className="h-screen bg-gray-100 flex flex-col font-sans text-black overflow-hidden">
      <Toaster position="top-center" />
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0 flex items-center justify-between">
        <Image src={logo2} alt="GRAET Logo" width={100} height={8} priority className="md:w-[120px]" />
        <div ref={exportMenuRef} className="relative">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            disabled={!hasGeneratedReport}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm font-semibold bg-[#0e0c66] text-white rounded-lg hover:bg-[#0e0c66]/85 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
              <button
                onClick={() => handleExport("pdf")}
                className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
              >
                <FileDown className="w-4 h-4 text-red-600" />
                <span>Save as PDF</span>
              </button>
              <button
                onClick={() => handleExport("txt")}
                className="w-full text-left flex items-center space-x-2 p-2 text-sm hover:bg-gray-100"
              >
                <FileText className="w-4 h-4 text-gray-600" />
                <span>Save as Text</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <div
          className={`
            flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-40
            transition-all duration-300 ease-in-out
            
            lg:relative
            ${isDesktopSidebarCollapsed ? 'lg:w-0' : 'lg:w-1/3'}

            absolute top-0 left-0 h-full w-full max-w-md sm:w-96 lg:max-w-none
            transform lg:transform-none
            ${isMobileSidebarOpen ? "translate-x-0 shadow-lg" : "-translate-x-full"}
          `}
        >
          <div className={`flex-1 flex flex-col space-y-6 min-h-0 overflow-y-auto p-4 md:p-6 ${isDesktopSidebarCollapsed ? 'lg:hidden' : ''}`}>
            
            {/* --- NEW UPLOAD UI --- */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Upload Audio
              </h2>
              <label
                htmlFor="file-upload"
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#0e0c66] hover:bg-gray-50 cursor-pointer transition-colors block"
              >
                <div className="flex flex-col items-center justify-center">
                  <Upload className="mx-auto w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-[#0e0c66]">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    MP3, WAV, M4A (20MB limit per file)
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {selectedFile && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-800">Selected file:</p>
                  {[selectedFile].map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-2.5 border rounded-lg bg-white shadow-sm"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* --- END OF NEW UPLOAD UI --- */}

            <div className="flex flex-col flex-1 min-h-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                2. Review Transcription
              </h2>
              <textarea
                value={transcriptionText}
                onChange={(e) => setTranscriptionText(e.target.value)}
                className="flex-1 w-full p-4 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#0e0c66]"
                placeholder="Your audio transcription will appear here..."
              />
            </div>
            <div>
              <button
                onClick={handleProcessAudio}
                disabled={isLoading || !selectedFile}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-[#0e0c66] text-white font-semibold rounded-lg hover:bg-[#0e0c66]/85 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5" />
                <span>{buttonText}</span>
              </button>
            </div>
          </div>
        </div>

        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden absolute inset-0 bg-black bg-opacity-50 z-30"
          ></div>
        )}

        <div className="flex-1 bg-gray-50 flex flex-col relative">
          <EditorToolbar
            editor={editor}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onToggleDesktopSidebar={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
          />
          {editor && (
            <>
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: "top" }}
                shouldShow={({ editor }) => {
                  const { selection } = editor.state;
                  const { $from, empty } = selection;
                  if (empty || $from.depth < 2) {
                    return false;
                  }
                  return !editor.isActive("table");
                }}
                className="flex items-center space-x-1 bg-black text-white p-2 rounded-lg shadow-xl"
              >
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1 ${editor.isActive("bold") ? "bg-gray-700" : ""} rounded`}
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1 ${editor.isActive("italic") ? "bg-gray-700" : ""} rounded`}
                >
                  <Italic className="w-4 h-4" />
                </button>
              </BubbleMenu>
              <TableMenus editor={editor} />
              <div className="flex-1 p-2 sm:p-4 overflow-y-auto">
                <div className="bg-white min-h-full rounded-lg shadow-sm">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </>
          )}
          {!hasGeneratedReport && (
            <EditorPlaceholder onStart={() => setIsMobileSidebarOpen(true)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoutingPlatformPage;
