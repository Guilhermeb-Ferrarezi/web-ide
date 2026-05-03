export type AuthUser = {
  userId: string;
  login: string;
  avatarUrl?: string;
  role?: 'owner' | 'admin' | 'user' | 'terminal_superuser';
};

export type RemoteRepo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  cloneUrl: string;
  defaultBranch: string;
  updatedAt: string | null;
  description: string | null;
  language: string | null;
  cloned: boolean;
};

export type LocalRepo = {
  id: string;
  slug: string;
  githubFullName: string;
  permission: 'read' | 'write';
  path: string;
  canManage: boolean;
};

export type RepoPermissionEntry = {
  userId: string;
  login: string | null;
  permission: 'read' | 'write';
};

export type ShareUserCandidate = {
  userId: string;
  login: string;
  avatarUrl: string | null;
};

export type RepoPagination = {
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ReposPayload = {
  githubRepos: RemoteRepo[];
  localRepos: LocalRepo[];
  githubPagination: RepoPagination;
  localPagination: RepoPagination;
};

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
};

export type FileContent = {
  encoding: 'utf-8' | 'base64';
  content: string;
  size: number;
  mimeType: string;
};

export type EditorProjectFile = {
  path: string;
  content: string;
};

export type CodeSearchMatch = {
  line: number;
  column: number;
  length: number;
  preview: string;
  previewOffset: number;
};

export type CodeSearchResult = {
  path: string;
  matches: CodeSearchMatch[];
};

export type CodeSearchOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
};

export type AssistantChatRole = 'user' | 'assistant';

export type AssistantChatMessage = {
  role: AssistantChatRole;
  content: string;
};

export type AssistantChatRequest = {
  workspace: string;
  activePath?: string | null;
  activeContent?: string | null;
  messages: AssistantChatMessage[];
};

export type AssistantChatResponse = {
  message: string;
  model: string;
};

export type GitFileStatus = {
  path: string;
  index: string;
  workingDir: string;
  staged: boolean;
  unstaged: boolean;
};

export type GitStatus = {
  branch: string | null;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
};

export type GitDiffFileResponse = {
  mode: 'staged' | 'unstaged';
  baseContent: string;
  targetContent: string;
};

export type EditorTab = {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  encoding: 'utf-8' | 'base64';
  mimeType: string;
  dirty: boolean;
  kind?: 'file' | 'extension' | 'git-diff';
  iconUrl?: string | null;
  extensionDetail?: ExtensionDetail | null;
  isLoading?: boolean;
  loadingLabel?: string | null;
  gitDiff?: {
    filePath: string;
    staged: boolean;
    originalLabel: string;
    modifiedLabel: string;
  } | null;
};

export type MonacoThemeRule = {
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
};

export type InstalledTheme = {
  id: string;
  extensionId: string;
  label: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
  colors: Record<string, string>;
  rules: MonacoThemeRule[];
};

export type InstalledIconTheme = {
  id: string;
  extensionId: string;
  label: string;
  icons: {
    file: string;
    folder: string;
    folderExpanded: string;
    fileNames: Record<string, string>;
    fileExtensions: Record<string, string>;
    folderNames: Record<string, string>;
    folderNamesExpanded: Record<string, string>;
    languageIds: Record<string, string>;
    iconDefinitions: Record<string, string>;
  };
};

export type MarketplaceExtension = {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string | null;
  version: string;
  iconUrl: string | null;
  downloadCount: number;
  averageRating?: number;
  verified?: boolean;
};

export type InstalledExtensionPayload = {
  extensionId: string;
  displayName: string;
  themes: InstalledTheme[];
  iconThemes: InstalledIconTheme[];
};

export type InstalledExtensionsStatePayload = {
  themes: InstalledTheme[];
  iconThemes: InstalledIconTheme[];
};

export type ExtensionResource = {
  label: string;
  url: string;
};

export type ExtensionDetail = {
  extension: MarketplaceExtension;
  readme: string | null;
  resources: ExtensionResource[];
  categories: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  installSupport: {
    supported: boolean;
    kinds: Array<'theme' | 'iconTheme'>;
    reason: string | null;
  };
};
