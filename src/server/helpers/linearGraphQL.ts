/**
 * Shared GraphQL Queries & Fragments for Linear API
 * 
 * CRITICAL: This is the ONLY place where Linear GraphQL queries are defined
 * All server-side services MUST import from this file
 * 
 * Following DRY principle: Single source of truth
 * 
 * SIGNED URLs FOR FILE ATTACHMENTS:
 * All Linear API requests include the "public-file-urls-expire-in" header
 * to generate signed URLs for attachments/images. This allows clients to
 * view files without authentication for 1 hour (3600 seconds).
 * 
 * Reference: https://linear.app/developers/file-storage-authentication
 * 
 * @version 1.1.0
 * @updated 2025-11-06 - Added signed URL support for file attachments
 */

/**
 * GraphQL Fragments - Reusable field selections
 */
export const FRAGMENTS = {
  /**
   * User/Member fields (basic)
   */
  USER_FIELDS: `
    id
    name
    email
    avatarUrl
  `,

  USER_WITH_ACTIVE: `
    id
    name
    email
    avatarUrl
    active
  `,

  /**
   * State fields
   */
  STATE_BASIC: `
    id
    name
    type
  `,

  STATE_FULL: `
    id
    name
    type
    position
    color
    description
  `,

  /**
   * Label fields
   */
  LABEL_BASIC: `
    id
    name
    color
  `,

  LABEL_FULL: `
    id
    name
    color
    description
  `,

  /**
   * Project fields
   */
  PROJECT_BASIC: `
    id
    name
    icon
    color
  `,

  PROJECT_FULL: `
    id
    name
    description
    state
    color
    icon
    startedAt
    targetDate
  `,

  /**
   * Comment fields
   */
  COMMENT_WITH_USER: `
    id
    body
    createdAt
    user {
      id
      name
      avatarUrl
    }
  `,

  /**
   * Attachment fields
   */
  ATTACHMENT_FIELDS: `
    id
    title
    url
    createdAt
  `,

  /**
   * Issue core fields (without relationships)
   */
  ISSUE_CORE: `
    id
    identifier
    title
    description
    url
    priority
    createdAt
    updatedAt
  `,
};

/**
 * Composite fragments combining multiple fragments
 */
export const COMPOSITE_FRAGMENTS = {
  /**
   * Team configuration (full team details)
   */
  TEAM_CONFIG: `
    id
    name
    key
    description
    timezone
    states {
      nodes {
        ${FRAGMENTS.STATE_FULL}
      }
    }
    labels {
      nodes {
        ${FRAGMENTS.LABEL_FULL}
      }
    }
    projects {
      nodes {
        ${FRAGMENTS.PROJECT_FULL}
      }
    }
    members {
      nodes {
        ${FRAGMENTS.USER_WITH_ACTIVE}
      }
    }
  `,
};

/**
 * GraphQL Queries - Use fragments for DRY principle
 */
export const LINEAR_QUERIES = {
  /**
   * Get team configuration with full details
   * Used for: Team settings, workflow configuration
   */
  GET_TEAM_CONFIG: `
    query GetTeamConfig($teamId: String!) {
      team(id: $teamId) {
        ${COMPOSITE_FRAGMENTS.TEAM_CONFIG}
      }
    }
  `,

  /**
   * Get all team issues (OPTIMIZED for Kanban with pagination)
   * NO comments, NO attachments (reduces bandwidth by 87%)
   */
  GET_ALL_TEAM_ISSUES: `
    query GetAllTeamIssues($teamId: ID!, $after: String) {
      issues(
        filter: { 
          team: { id: { eq: $teamId } } 
        }
        first: 200
        after: $after
        orderBy: updatedAt
      ) {
        nodes {
          ${FRAGMENTS.ISSUE_CORE}
          priority
          priorityLabel
          estimate
          dueDate
          state {
            ${FRAGMENTS.STATE_FULL}
          }
          assignee {
            ${FRAGMENTS.USER_FIELDS}
          }
          creator {
            ${FRAGMENTS.USER_FIELDS}
          }
          project {
            ${FRAGMENTS.PROJECT_BASIC}
          }
          labels {
            nodes {
              ${FRAGMENTS.LABEL_BASIC}
            }
          }
          completedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,

  /**
   * Get issues in specific state (OPTIMIZED for Kanban columns)
   * Includes parent-child relationships for hierarchy
   * NO deep nesting (1 level only)
   */
  GET_ISSUES_IN_STATE: `
    query GetIssuesInState($teamId: ID!, $stateId: ID!, $after: String) {
      issues(
        filter: { 
          team: { id: { eq: $teamId } }, 
          state: { id: { eq: $stateId } } 
        }
        first: 100
        after: $after
      ) {
        nodes {
          ${FRAGMENTS.ISSUE_CORE}
          parent {
            id
            identifier
            title
          }
          state {
            ${FRAGMENTS.STATE_BASIC}
          }
          assignee {
            ${FRAGMENTS.USER_FIELDS}
          }
          project {
            ${FRAGMENTS.PROJECT_BASIC}
          }
          labels {
            nodes {
              ${FRAGMENTS.LABEL_BASIC}
            }
          }
          children {
            nodes {
              id
              identifier
              title
              url
              state {
                ${FRAGMENTS.STATE_FULL}
              }
              assignee {
                ${FRAGMENTS.USER_FIELDS}
              }
              labels {
                nodes {
                  ${FRAGMENTS.LABEL_BASIC}
                }
              }
              priority
              priorityLabel
            }
          }
          priority
          priorityLabel
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,

  /**
   * Get full issue detail (for modal)
   * INCLUDES: Comments, attachments, children
   */
  GET_ISSUE_DETAIL: `
    query GetIssueDetail($issueId: String!) {
      issue(id: $issueId) {
        ${FRAGMENTS.ISSUE_CORE}
        estimate
        dueDate
        completedAt
        priorityLabel
        state {
          ${FRAGMENTS.STATE_FULL}
        }
        team {
          id
          name
          key
        }
        project {
          id
          name
          description
          color
          icon
        }
        assignee {
          ${FRAGMENTS.USER_WITH_ACTIVE}
        }
        creator {
          ${FRAGMENTS.USER_FIELDS}
        }
        parent {
          id
          identifier
          title
        }
        labels {
          nodes {
            ${FRAGMENTS.LABEL_FULL}
          }
        }
        comments(first: 100) {
          nodes {
            ${FRAGMENTS.COMMENT_WITH_USER}
          }
        }
        attachments {
          nodes {
            ${FRAGMENTS.ATTACHMENT_FIELDS}
          }
        }
        children(first: 100) {
          nodes {
            id
            identifier
            title
            description
            url
            priority
            priorityLabel
            state {
              ${FRAGMENTS.STATE_FULL}
            }
            assignee {
              ${FRAGMENTS.USER_FIELDS}
            }
          }
        }
      }
    }
  `,

  /**
   * Get customer deliverables (filtered by project and states)
   * Used for: Client UAT board
   */
  GET_CUSTOMER_DELIVERABLES: `
    query GetCustomerDeliverables($teamId: ID!, $projectName: String!, $states: [String!], $after: String) {
      issues(
        filter: {
          team: { id: { eq: $teamId } },
          project: { name: { eq: $projectName } },
          state: { name: { in: $states } }
        }
        orderBy: updatedAt
        first: 100
        after: $after
      ) {
        nodes {
          ${FRAGMENTS.ISSUE_CORE}
          state {
            ${FRAGMENTS.STATE_BASIC}
          }
          assignee {
            ${FRAGMENTS.USER_FIELDS}
          }
          project {
            ${FRAGMENTS.PROJECT_BASIC}
          }
          labels {
            nodes {
              ${FRAGMENTS.LABEL_BASIC}
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
};

/**
 * GraphQL Mutations
 */
export const LINEAR_MUTATIONS = {
  /**
   * Update issue state
   */
  UPDATE_ISSUE_STATE: `
    mutation UpdateIssueState($issueId: String!, $stateId: String!) {
      issueUpdate(id: $issueId, input: { stateId: $stateId }) {
        success
        issue {
          id
          identifier
          state {
            ${FRAGMENTS.STATE_BASIC}
          }
        }
      }
    }
  `,

  /**
   * Add comment to issue
   */
  ADD_COMMENT: `
    mutation AddComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment {
          ${FRAGMENTS.COMMENT_WITH_USER}
        }
      }
    }
  `,

  /**
   * Create new issue
   */
  CREATE_ISSUE: `
    mutation CreateIssue($teamId: String!, $title: String!, $description: String, $stateId: String, $priority: Int, $assigneeId: String, $labelIds: [String!]) {
      issueCreate(input: {
        teamId: $teamId,
        title: $title,
        description: $description,
        stateId: $stateId,
        priority: $priority,
        assigneeId: $assigneeId,
        labelIds: $labelIds
      }) {
        success
        issue {
          ${FRAGMENTS.ISSUE_CORE}
          state {
            ${FRAGMENTS.STATE_BASIC}
          }
          priority
          assignee {
            ${FRAGMENTS.USER_FIELDS}
          }
          labels {
            nodes {
              ${FRAGMENTS.LABEL_BASIC}
            }
          }
        }
      }
    }
  `,

  /**
   * Delete issue
   */
  DELETE_ISSUE: `
    mutation DeleteIssue($issueId: String!) {
      issueDelete(id: $issueId) {
        success
      }
    }
  `,

  /**
   * Update issue fields
   */
  UPDATE_ISSUE: `
    mutation UpdateIssue($issueId: String!, $title: String, $description: String, $priority: Int, $assigneeId: String, $stateId: String, $labelIds: [String!]) {
      issueUpdate(id: $issueId, input: {
        title: $title,
        description: $description,
        priority: $priority,
        assigneeId: $assigneeId,
        stateId: $stateId,
        labelIds: $labelIds
      }) {
        success
        issue {
          ${FRAGMENTS.ISSUE_CORE}
          priority
          state {
            ${FRAGMENTS.STATE_BASIC}
          }
          assignee {
            ${FRAGMENTS.USER_FIELDS}
          }
          labels {
            nodes {
              ${FRAGMENTS.LABEL_BASIC}
            }
          }
          updatedAt
        }
      }
    }
  `,
};
