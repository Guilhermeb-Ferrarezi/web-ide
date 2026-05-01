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

export type CodeSearchMatch = {
  line: number;
  column: number;
  preview: string;
};

export type CodeSearchResult = {
  path: string;
  matches: CodeSearchMatch[];
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

export type EditorTab = {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  encoding: 'utf-8' | 'base64';
  mimeType: string;
  dirty: boolean;
};
