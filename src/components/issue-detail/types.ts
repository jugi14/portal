import type { LinearIssue } from '../../services/linearTeamIssuesService';

export interface IssueDetailModalProps {
  issue: LinearIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdate?: (updatedIssue: LinearIssue) => void;
  onIssueClick?: (issue: LinearIssue) => void;
  forceEnableComments?: boolean;
  showAcceptanceIssues?: boolean;
}

export interface IssueHeaderProps {
  issue: LinearIssue;
  navigationStack: LinearIssue[];
  onNavigateBack: () => void;
  onApprove: () => Promise<void>;
  onCancel: () => Promise<void>;
  onReopen: () => Promise<void>;
  onRequestChanges: () => void;
  isAdminOrSuperAdmin: boolean;
  loading: boolean;
}

export interface IssueMetadataProps {
  issue: LinearIssue;
}

export interface IssueDescriptionProps {
  description: string | null | undefined;
}

export interface IssueSubTasksProps {
  parentIssue: LinearIssue;
  subIssues: any[];
  teamConfig: any;
  onNavigateToSubIssue: (subIssue: any) => void;
  onSubIssueApproved: () => void;
  onSubIssueCreated: () => void;
  loading: boolean;
}

export interface IssueCommentsProps {
  issueId: string;
  comments: any[];
  commentsEnabled: boolean;
  onCommentAdded: () => void;
}

export interface NavigationState {
  stack: LinearIssue[];
  current: LinearIssue | null;
}
