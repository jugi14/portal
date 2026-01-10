export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
  position: number;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  members?: {
    nodes: LinearUser[];
  };
  membersCount?: number; // Computed field for convenience
  states?: {
    nodes: LinearState[];
  };
  labels?: {
    nodes: LinearLabel[];
  };
  createdAt?: string;
  updatedAt?: string;
}



export interface TeamHierarchyResponse {
  totalTeams: number;
  rootTeams: number;
  hierarchy: ProcessedTeam[];
  pagination?: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    totalPages: number;
  };
}

export interface ProcessedTeam {
  id: string;
  name: string;
  key: string;
  description: string | null;
  level: number;
  childCount: number;
  totalDescendants: number;
  children: ProcessedTeam[];
  membersCount?: number;
}

export interface LinearAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  authenticated?: boolean;
  requestedBy?: string;
  cached?: boolean;
}

// Utility function to compute membersCount from members.nodes
export function computeMembersCount(team: LinearTeam): number {
  return team.members?.nodes?.length || 0;
}

// Utility function to normalize team data
export function normalizeTeamData(team: any): LinearTeam {
  const normalized: LinearTeam = {
    id: team.id,
    name: team.name,
    key: team.key,
    description: team.description,
    members: team.members,
    states: team.states,
    labels: team.labels,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt
  };

  // Compute membersCount for convenience
  normalized.membersCount = computeMembersCount(normalized);

  return normalized;
}