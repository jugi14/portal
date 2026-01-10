export interface LinearState {
  id: string;
  name: string;
  type: string;
  position: number;
  color: string;
  description?: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  color: string;
  icon?: string;
  startedAt?: string;
  targetDate?: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  active: boolean;
}

export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: LinearUser;
}

export interface LinearAttachment {
  id: string;
  title: string;
  url: string;
  createdAt?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  priority?: number;
  priorityLabel?: string;
  estimate?: number;
  dueDate?: string;
  state: LinearState;
  team: {
    id: string;
    name: string;
    key: string;
  };
  project?: LinearProject;
  assignee?: LinearUser;
  creator: LinearUser;
  parent?: {
    id: string;
    identifier: string;
    title: string;
  };
  subIssues?: LinearIssue[];
  _originalSubIssueCount?: number;
  _hierarchyBreakdown?: {
    level1: number;
    level2: number;
    level3Plus: number;
    byState: Record<string, number>;
    total: number;
  };
  labels: LinearLabel[] | {
    nodes: LinearLabel[];
  };
  comments: LinearComment[] | {
    nodes: LinearComment[];
  };
  attachments: LinearAttachment[] | {
    nodes: LinearAttachment[];
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  timezone?: string;
  states: {
    nodes: LinearState[];
  };
  labels: {
    nodes: LinearLabel[];
  };
  projects: {
    nodes: LinearProject[];
  };
  members: {
    nodes: LinearUser[];
  };
}

export interface IssuesByParentResponse {
  parents: LinearIssue[];
  orphans: LinearIssue[];
  stats: {
    total: number;
    parents: number;
    children: number;
    orphans: number;
    byState: Record<string, number>;
  };
}
