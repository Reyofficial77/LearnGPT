// Small dictionary for the sidebar, the account menu and their dialogs.
// Safe to import from client components.
export type Lang = "id" | "en";
export const LANG_STORAGE_KEY = "learngpt_lang";
export const DEFAULT_LANG: Lang = "en";

const dict = {
  id: {
    newChat: "New Chat",
    workspace: "Workspace",
    project: "Project",
    chat: "Chat",
    sidebarLabel: "Navigasi",
    closeMenu: "Tutup menu",
    openMenu: "Buka menu",
    clearAll: "Hapus semua",
    deleteChat: "Hapus chat",
    deleteProject: "Hapus project",
    toggleProject: "Buka atau tutup project",
    noChats: "Chat tersimpan akan muncul di sini.",
    noProjectChats: "Belum ada chat di project ini.",
    accountMenu: "Menu akun",
    settings: "Pengaturan",
    language: "Bahasa",
    help: "Bantuan",
    signOut: "Keluar",
    close: "Tutup",
    cancel: "Batal",

    projectCreateTitle: "Buat project",
    projectCreateCopy: "Kelompokkan chat yang punya tujuan yang sama.",
    projectName: "Nama project",
    projectNamePlaceholder: "Contoh: Belajar Matematika",
    projectGoal: "Tujuan project",
    projectGoalPlaceholder: "Apa yang ingin dicapai di project ini?",
    projectGoalHint: "LearnGPT memakai tujuan ini sebagai konteks di setiap chat project.",
    projectAddress: "Alamat chat",
    projectRequired: "Nama dan tujuan project wajib diisi.",
    projectCreate: "Buat project",
    projectCreating: "Membuat…",
    projectDeleteTitle: "Hapus project?",
    projectDeleteBody: (name: string, count: number) => `“${name}” dan ${count} chat di dalamnya akan dihapus permanen.`,
    projectNotFound: "Project tidak ditemukan.",

    languageTitle: "Bahasa",
    languageCopy: "Pilih bahasa untuk menu, dialog, dan label sidebar.",

    helpTitle: "Bantuan",
    helpCopy: "Ringkasan cara memakai LearnGPT.",
    helpItems: [
      ["New Chat", "Mulai percakapan baru. Judul dibuat otomatis dari pesan pertamamu."],
      ["Project", "Kumpulkan chat yang punya tujuan sama. Nama dan tujuan project dipakai AI sebagai konteks."],
      ["Lampiran", "Tombol + di kolom pesan untuk menambahkan dokumen, file, atau gambar."],
      ["Pengaturan", "Atur instruksi belajar untuk AI. Pintasan: Ctrl+Shift+,"],
      ["Mengirim pesan", "Enter untuk mengirim, Shift+Enter untuk baris baru."]
    ] as [string, string][]
  },
  en: {
    newChat: "New Chat",
    workspace: "Workspace",
    project: "Project",
    chat: "Chat",
    sidebarLabel: "Navigation",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    clearAll: "Clear all",
    deleteChat: "Delete chat",
    deleteProject: "Delete project",
    toggleProject: "Expand or collapse project",
    noChats: "Your saved chats will appear here.",
    noProjectChats: "No chats in this project yet.",
    accountMenu: "Account menu",
    settings: "Settings",
    language: "Language",
    help: "Help",
    signOut: "Sign out",
    close: "Close",
    cancel: "Cancel",

    projectCreateTitle: "Create project",
    projectCreateCopy: "Group chats that share the same goal.",
    projectName: "Project name",
    projectNamePlaceholder: "e.g. Learn Calculus",
    projectGoal: "Project goal",
    projectGoalPlaceholder: "What do you want to achieve in this project?",
    projectGoalHint: "LearnGPT uses this goal as context in every chat of the project.",
    projectAddress: "Chat address",
    projectRequired: "Project name and goal are required.",
    projectCreate: "Create project",
    projectCreating: "Creating…",
    projectDeleteTitle: "Delete project?",
    projectDeleteBody: (name: string, count: number) => `“${name}” and its ${count} chat${count === 1 ? "" : "s"} will be permanently deleted.`,
    projectNotFound: "Project not found.",

    languageTitle: "Language",
    languageCopy: "Choose the language for the menu, dialogs, and sidebar labels.",

    helpTitle: "Help",
    helpCopy: "A quick guide to using LearnGPT.",
    helpItems: [
      ["New Chat", "Start a new conversation. Its title is generated from your first message."],
      ["Project", "Group chats that share a goal. The AI uses the project name and goal as context."],
      ["Attachments", "Use the + button in the message box to add documents, files, or images."],
      ["Settings", "Tune the learning instructions for the AI. Shortcut: Ctrl+Shift+,"],
      ["Sending messages", "Press Enter to send, Shift+Enter for a new line."]
    ] as [string, string][]
  }
};

export type Dict = typeof dict.id;
export function getDict(lang: Lang): Dict { return dict[lang] ?? dict[DEFAULT_LANG]; }
