export type AuthUser = {
  userId: string;
  login: string;
  avatarUrl?: string;
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
  name: string;
  path: string;
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
