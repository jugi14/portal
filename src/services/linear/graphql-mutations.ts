export const LINEAR_MUTATIONS = {
  UPDATE_ISSUE_STATE: `
    mutation UpdateIssueState($issueId: String!, $stateId: String!) {
      issueUpdate(id: $issueId, input: { stateId: $stateId }) {
        success
        issue {
          id
          identifier
          state {
            id
            name
            type
          }
        }
      }
    }
  `,

  ADD_COMMENT: `
    mutation AddComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment {
          id
          body
          createdAt
          user {
            name
          }
        }
      }
    }
  `,

  ADD_LABEL: `
    mutation AddLabel($issueId: String!, $labelId: String!) {
      issueAddLabel(id: $issueId, labelId: $labelId) {
        success
        issue {
          id
          labels {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `,

  CREATE_LABEL: `
    mutation CreateLabel($teamId: String!, $name: String!, $color: String, $description: String) {
      issueLabelCreate(input: {
        teamId: $teamId,
        name: $name,
        color: $color,
        description: $description
      }) {
        success
        issueLabel {
          id
          name
          color
          description
        }
      }
    }
  `,

  CREATE_ATTACHMENT: `
    mutation CreateAttachment($issueId: String!, $url: String!, $title: String!) {
      attachmentCreate(input: { issueId: $issueId, url: $url, title: $title }) {
        success
        attachment {
          id
          title
          url
        }
      }
    }
  `,

  UPDATE_ISSUE_ASSIGNEE: `
    mutation UpdateIssueAssignee($issueId: String!, $assigneeId: String!) {
      issueUpdate(id: $issueId, input: { assigneeId: $assigneeId }) {
        success
        issue {
          id
          assignee {
            id
            name
            email
          }
        }
      }
    }
  `,

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
          id
          identifier
          title
          description
          url
          state {
            id
            name
            type
          }
          priority
          assignee {
            id
            name
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          createdAt
        }
      }
    }
  `,

  CREATE_SUB_ISSUE: `
    mutation CreateSubIssue($parentId: String!, $title: String!, $description: String) {
      issueCreate(input: {
        parentId: $parentId,
        title: $title,
        description: $description
      }) {
        success
        issue {
          id
          identifier
          title
          description
          url
          parent {
            id
            identifier
            title
          }
          state {
            id
            name
            type
          }
          createdAt
        }
      }
    }
  `,

  DELETE_ISSUE: `
    mutation DeleteIssue($issueId: String!) {
      issueDelete(id: $issueId) {
        success
      }
    }
  `,

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
          id
          identifier
          title
          description
          priority
          state {
            id
            name
            type
          }
          assignee {
            id
            name
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          updatedAt
        }
      }
    }
  `,

  UPDATE_ISSUE_CYCLE: `
    mutation UpdateIssueCycle($issueId: String!, $cycleId: String) {
      issueUpdate(id: $issueId, input: { cycleId: $cycleId }) {
        success
        issue {
          id
          identifier
          cycle {
            id
            name
            number
            startsAt
            endsAt
          }
        }
      }
    }
  `,

  GET_TEAM_CYCLES: `
    query GetTeamCycles($teamId: String!) {
      team(id: $teamId) {
        cycles(
          filter: { isActive: { eq: true } }
        ) {
          nodes {
            id
            name
            number
            startsAt
            endsAt
            isActive
            progress
          }
        }
      }
    }
  `,

  GET_NEXT_CYCLE: `
    query GetNextCycle($teamId: String!) {
      team(id: $teamId) {
        cycles(
          filter: { 
            isActive: { eq: true }
            isFuture: { eq: true }
          }
          first: 1
        ) {
          nodes {
            id
            name
            number
            startsAt
            endsAt
          }
        }
      }
    }
  `
};