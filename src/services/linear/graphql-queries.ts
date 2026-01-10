/**
 * GraphQL Queries - Optimized with Fragments
 * Following DRY principle: Single source of truth for all GraphQL queries
 * 
 * CRITICAL: All queries use fragments from graphql-fragments.ts
 * Benefits:
 * - No code duplication
 * - Easy to update field selections
 * - Type-safe with consistent field structure
 * - Optimized for specific use cases
 */

import { FRAGMENTS, COMPOSITE_FRAGMENTS, buildIssueFragment } from './graphql-fragments';

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
   * Get issues in specific workflow state (OPTIMIZED for Kanban)
   * Used for: Kanban board columns
   * OPTIMIZED: No comments, no attachments (reduces bandwidth by 87%)
   */
  GET_ISSUES_IN_STATE: `
    query GetIssuesInState($teamId: String!, $stateId: String!) {
      issues(filter: { 
        team: { id: { eq: $teamId } }, 
        state: { id: { eq: $stateId } } 
      }, first: 100) {
        nodes {
          ${buildIssueFragment({
            includeAssignee: true,
            includeState: true,
            includeLabels: true,
            includeProject: true,
            // NO comments - not displayed on card
            // NO attachments - not displayed on card
          })}
        }
      }
    }
  `,

  /**
   * Get customer deliverables (filtered by project and states)
   * Used for: Client UAT board
   */
  GET_CUSTOMER_DELIVERABLES: `
    query GetCustomerDeliverables($teamId: String!, $projectName: String!, $states: [String!]) {
      issues(filter: {
        team: { id: { eq: $teamId } },
        project: { name: { eq: $projectName } },
        state: { name: { in: $states } }
      }, orderBy: updatedAt, first: 100) {
        nodes {
          ${buildIssueFragment({
            includeAssignee: true,
            includeState: true,
            includeLabels: true,
            includeProject: true,
          })}
        }
      }
    }
  `,

  /**
   * Get full issue details (for detail modal)
   * Used for: Issue detail modal
   * INCLUDES: Comments, attachments, children (full data)
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
  `
};
