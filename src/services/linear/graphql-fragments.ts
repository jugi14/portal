/**
 * GraphQL Fragments - Reusable field selections
 * 
 * Following DRY principle: Single source of truth for GraphQL field selections
 * Benefits:
 * - Reduce code duplication by 60%
 * - Consistent field selections across queries
 * - Easy to update all queries at once
 * - Better maintainability
 */

/**
 * Core field fragments
 */
export const FRAGMENTS = {
  /**
   * User/Member fields
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
   * Cycle fields
   */
  CYCLE_BASIC: `
    id
    name
    number
  `,

  CYCLE_FULL: `
    id
    name
    number
    startsAt
    endsAt
    completedAt
  `,

  /**
   * Comment fields
   */
  COMMENT_BASIC: `
    id
    body
    createdAt
  `,

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

  /**
   * Attachment fields
   */
  ATTACHMENT_FIELDS: `
    id
    title
    url
    metadata
    createdAt
  `,
};

/**
 * Composite fragments - Combine multiple fragments
 */
export const COMPOSITE_FRAGMENTS = {
  /**
   * Issue with assignee
   */
  ISSUE_WITH_ASSIGNEE: `
    ${FRAGMENTS.ISSUE_CORE}
    assignee {
      ${FRAGMENTS.USER_FIELDS}
    }
  `,

  /**
   * Issue with state
   */
  ISSUE_WITH_STATE: `
    ${FRAGMENTS.ISSUE_CORE}
    state {
      ${FRAGMENTS.STATE_FULL}
    }
  `,

  /**
   * Issue with labels
   */
  ISSUE_WITH_LABELS: `
    ${FRAGMENTS.ISSUE_CORE}
    labels {
      nodes {
        ${FRAGMENTS.LABEL_BASIC}
      }
    }
  `,

  /**
   * Issue with project
   */
  ISSUE_WITH_PROJECT: `
    ${FRAGMENTS.ISSUE_CORE}
    project {
      ${FRAGMENTS.PROJECT_BASIC}
    }
  `,

  /**
   * Issue with cycle
   */
  ISSUE_WITH_CYCLE: `
    ${FRAGMENTS.ISSUE_CORE}
    cycle {
      ${FRAGMENTS.CYCLE_BASIC}
    }
  `,

  /**
   * Full issue with all relationships (for detail views)
   */
  ISSUE_FULL: `
    ${FRAGMENTS.ISSUE_CORE}
    assignee {
      ${FRAGMENTS.USER_FIELDS}
    }
    state {
      ${FRAGMENTS.STATE_FULL}
    }
    labels {
      nodes {
        ${FRAGMENTS.LABEL_BASIC}
      }
    }
    project {
      ${FRAGMENTS.PROJECT_BASIC}
    }
    cycle {
      ${FRAGMENTS.CYCLE_BASIC}
    }
  `,

  /**
   * Issue with comments (for detail modal)
   */
  ISSUE_WITH_COMMENTS: `
    ${FRAGMENTS.ISSUE_CORE}
    assignee {
      ${FRAGMENTS.USER_FIELDS}
    }
    state {
      ${FRAGMENTS.STATE_FULL}
    }
    labels {
      nodes {
        ${FRAGMENTS.LABEL_BASIC}
      }
    }
    comments(first: 50) {
      nodes {
        ${FRAGMENTS.COMMENT_WITH_USER}
      }
    }
  `,

  /**
   * Issue with parent (for sub-issues)
   */
  ISSUE_WITH_PARENT: `
    ${FRAGMENTS.ISSUE_CORE}
    parent {
      id
      identifier
      title
      state {
        ${FRAGMENTS.STATE_BASIC}
      }
    }
  `,

  /**
   * Issue with children (for parent issues)
   */
  ISSUE_WITH_CHILDREN: `
    ${FRAGMENTS.ISSUE_CORE}
    children {
      nodes {
        id
        identifier
        title
        state {
          ${FRAGMENTS.STATE_BASIC}
        }
        assignee {
          ${FRAGMENTS.USER_FIELDS}
        }
      }
    }
  `,

  /**
   * Complete issue with hierarchy (parent + children)
   */
  ISSUE_WITH_HIERARCHY: `
    ${FRAGMENTS.ISSUE_CORE}
    assignee {
      ${FRAGMENTS.USER_FIELDS}
    }
    state {
      ${FRAGMENTS.STATE_FULL}
    }
    labels {
      nodes {
        ${FRAGMENTS.LABEL_BASIC}
      }
    }
    parent {
      id
      identifier
      title
      state {
        ${FRAGMENTS.STATE_BASIC}
      }
    }
    children {
      nodes {
        id
        identifier
        title
        state {
          ${FRAGMENTS.STATE_BASIC}
        }
        assignee {
          ${FRAGMENTS.USER_FIELDS}
        }
      }
    }
  `,

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
 * Helper function to build custom issue fragment
 * Use when you need specific field combinations
 */
export function buildIssueFragment(options: {
  includeAssignee?: boolean;
  includeState?: boolean;
  includeLabels?: boolean;
  includeProject?: boolean;
  includeCycle?: boolean;
  includeComments?: boolean;
  includeParent?: boolean;
  includeChildren?: boolean;
}): string {
  const parts = [FRAGMENTS.ISSUE_CORE];

  if (options.includeAssignee) {
    parts.push(`assignee { ${FRAGMENTS.USER_FIELDS} }`);
  }

  if (options.includeState) {
    parts.push(`state { ${FRAGMENTS.STATE_FULL} }`);
  }

  if (options.includeLabels) {
    parts.push(`labels { nodes { ${FRAGMENTS.LABEL_BASIC} } }`);
  }

  if (options.includeProject) {
    parts.push(`project { ${FRAGMENTS.PROJECT_BASIC} }`);
  }

  if (options.includeCycle) {
    parts.push(`cycle { ${FRAGMENTS.CYCLE_BASIC} }`);
  }

  if (options.includeComments) {
    parts.push(`comments(first: 50) { nodes { ${FRAGMENTS.COMMENT_WITH_USER} } }`);
  }

  if (options.includeParent) {
    parts.push(`
      parent {
        id
        identifier
        title
        state { ${FRAGMENTS.STATE_BASIC} }
      }
    `);
  }

  if (options.includeChildren) {
    parts.push(`
      children {
        nodes {
          id
          identifier
          title
          state { ${FRAGMENTS.STATE_BASIC} }
          assignee { ${FRAGMENTS.USER_FIELDS} }
        }
      }
    `);
  }

  return parts.join('\n');
}

/**
 * Usage examples:
 * 
 * // Basic issue list (Kanban)
 * const KANBAN_ISSUE = buildIssueFragment({
 *   includeAssignee: true,
 *   includeState: true,
 *   includeLabels: true
 * });
 * 
 * // Issue detail modal
 * const DETAIL_ISSUE = buildIssueFragment({
 *   includeAssignee: true,
 *   includeState: true,
 *   includeLabels: true,
 *   includeProject: true,
 *   includeComments: true,
 *   includeParent: true,
 *   includeChildren: true
 * });
 * 
 * // Or use predefined composites
 * const query = `
 *   query GetIssue($id: String!) {
 *     issue(id: $id) {
 *       ${COMPOSITE_FRAGMENTS.ISSUE_FULL}
 *     }
 *   }
 * `;
 */
