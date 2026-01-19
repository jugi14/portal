/**
 * Server-side Linear Team Issues Service
 *
 * Handles GraphQL requests to Linear API for Team Issues Dashboard
 * This service runs on the server and handles authentication with Linear API
 *
 * SIGNED URLs: All requests include "public-file-urls-expire-in" header
 * to generate 1-hour signed URLs for attachments/images so clients can
 * view them without authentication.
 *
 * @version 2.3.0
 * @updated 2025-11-06 - Added signed URL support for file attachments
 */

import { createClient } from "@supabase/supabase-js";
import { LINEAR_QUERIES, FRAGMENTS } from "../helpers/linearGraphQL";
import * as kv from "../kv_store";

// Linear GraphQL endpoint
const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Get Linear API key from environment or KV store
 */
async function getLinearApiKey(): Promise<string> {
  // First try environment variable
  const envKey = process.env.LINEAR_API_KEY;
  if (envKey) {
    return envKey;
  }

  // Fallback to KV store
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("kv_store_7f0d90fb")
      .select("value")
      .eq("key", "linear_api_key")
      .single();

    if (error || !data?.value) {
      throw new Error("Linear API key not found in environment or KV store");
    }

    return data.value;
  } catch (error) {
    console.error("Failed to get Linear API key:", error);
    throw new Error("Linear API key not configured");
  }
}

/**
 * Execute GraphQL query against Linear API with improved error handling
 */
export async function executeLinearQuery(
  query: string,
  variables: Record<string, any> = {}
): Promise<any> {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();

  try {
    const apiKey = await getLinearApiKey();

    // Extract query name for better logging
    const queryNameMatch = query.match(/(?:query|mutation)\s+(\w+)/);
    const queryName = queryNameMatch ? queryNameMatch[1] : "UnknownQuery";

    // PERFORMANCE: Reduced logging - only log essential info
    const requestPayload = {
      query,
      variables,
    };

    // PERFORMANCE: Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "User-Agent": "Teifi-Digital-Client-Portal/1.0",
        "public-file-urls-expire-in": "3600", // 1 hour signed URLs for attachments
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    // Only log slow requests (> 1s) or errors
    if (responseTime > 1000 || !response.ok) {
      console.log(
        `[${requestId}] [Linear API] ${queryName} - ${responseTime}ms (${response.status})`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${requestId}] [Linear API] HTTP Error for ${queryName}:`,
        {
          status: response.status,
          statusText: response.statusText,
          responseBody: errorText,
          headers: Object.fromEntries(response.headers.entries()),
        }
      );
      throw new Error(
        `Linear API HTTP Error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error(
        `[${requestId}] [Linear API] GraphQL Errors for ${queryName}:`,
        {
          errors: result.errors,
          query: queryName,
          variables: variables,
          fullResponse: result,
        }
      );

      // Log the exact query and variables that caused the error
      console.error(`[${requestId}] [Linear API] Failed Query Details:`);
      console.error(`[${requestId}] [Linear API] Query Name: ${queryName}`);
      console.error(
        `[${requestId}] [Linear API] Variables: ${JSON.stringify(
          variables,
          null,
          2
        )}`
      );
      console.error(`[${requestId}] [Linear API] Query Text: ${query}`);

      // Check for specific error types
      const errorMessage = result.errors[0]?.message || "Unknown GraphQL error";

      // Type mismatch errors
      if (
        errorMessage.includes("Variable") &&
        errorMessage.includes("type") &&
        errorMessage.includes("expecting")
      ) {
        console.error(
          `[${requestId}] [Linear API] TYPE MISMATCH ERROR in ${queryName}:`
        );
        console.error(`[${requestId}] [Linear API] Error: ${errorMessage}`);
        console.error(
          `[${requestId}] [Linear API] This indicates variable type doesn't match GraphQL schema`
        );
        throw new Error(
          `Linear GraphQL Type Error in ${queryName}: ${errorMessage}`
        );
      }

      // Team not found errors
      if (errorMessage.includes("Entity not found: Team")) {
        const teamId = variables.teamId;
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        console.warn(`️ [${requestId}] [Linear API] Team entity not found:`, {
          teamId,
          isUUID: teamId && uuidPattern.test(teamId),
          queryName,
        });

        if (teamId && uuidPattern.test(teamId)) {
          console.warn(
            `️ [${requestId}] [Linear API] UUID team ${teamId} not found in Linear workspace`
          );
          throw new Error(`UUID team not found in Linear workspace: ${teamId}`);
        }

        console.warn(
          `️ [${requestId}] [Linear API] Team ${teamId} not found in Linear workspace`
        );
        throw new Error(`Team not found in Linear workspace: ${teamId}`);
      }

      throw new Error(`Linear GraphQL Error in ${queryName}: ${errorMessage}`);
    }

    if (!result.data) {
      console.error(
        `️ [${requestId}] [Linear API] No data in response for ${queryName}:`,
        {
          fullResponse: result,
          queryName,
          variables,
        }
      );
      throw new Error(
        `No data returned from Linear GraphQL query: ${queryName}`
      );
    }

    // Only log slow requests
    if (responseTime > 1000) {
      console.log(
        `[${requestId}] [Linear API] ${queryName} completed in ${responseTime}ms`
      );
    }

    return result.data;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}] [Linear API] Request failed:`, {
      error: error instanceof Error ? error.message : String(error),
      errorType: error?.constructor?.name,
      responseTime: `${responseTime}ms`,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Helper to analyze data structure for logging
 */
function getDataStructure(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return `Array(${data.length})`;
  }

  if (typeof data === "object") {
    const structure: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        structure[key] = null;
      } else if (Array.isArray(value)) {
        structure[key] = `Array(${value.length})`;
      } else if (typeof value === "object") {
        structure[key] = `Object(${Object.keys(value).length} keys)`;
      } else {
        structure[key] = typeof value;
      }
    }
    return structure;
  }

  return typeof data;
}

/**
 * Team Issues Service Functions
 */

export async function getTeamConfig(teamId: string) {
  // Use shared query from linearGraphQL.tsx (DRY principle)
  try {
    const data = await executeLinearQuery(LINEAR_QUERIES.GET_TEAM_CONFIG, {
      teamId,
    });

    // Safely check if data and team exist
    if (!data || !data.team) {
      console.warn(
        `️ [getTeamConfig] No team data returned for teamId: ${teamId}`
      );
      return null;
    }

    // Transform GraphQL response to expected client format
    const team = data.team;

    return {
      id: team.id,
      name: team.name,
      key: team.key,
      description: team.description,
      timezone: team.timezone,
      // Transform GraphQL nodes arrays to simple arrays
      states: team.states?.nodes || [],
      labels: team.labels?.nodes || [],
      members: team.members?.nodes || [],
      projects: team.projects?.nodes || [],
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  } catch (error) {
    //Gracefully handle team not found errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("team not found") ||
      errorMessage.includes("Entity not found: Team")
    ) {
      console.warn(`️ [getTeamConfig] Team not found in Linear: ${teamId}`);
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

export async function getAllTeamIssues(teamId: string) {
  // OPTIMIZED: Use shared query from linearGraphQL.tsx (DRY principle)
  // NO comments, NO attachments (87% bandwidth reduction)

  let allIssues: any[] = [];
  let after: string | undefined = undefined;
  let pageCount = 0;

  console.log(`[Pagination] Starting to fetch all issues for team ${teamId}`);

  while (true) {
    pageCount++;
    console.log(
      `[Pagination] Fetching page ${pageCount}${
        after ? ` (cursor: ${after.substring(0, 10)}...)` : ""
      }`
    );

    const data = await executeLinearQuery(LINEAR_QUERIES.GET_ALL_TEAM_ISSUES, {
      teamId,
      after,
    });
    const issues = data.issues.nodes;
    allIssues = allIssues.concat(issues);

    console.log(
      `[Pagination] Page ${pageCount}: Retrieved ${issues.length} issues (total: ${allIssues.length})`
    );

    const pageInfo = data.issues.pageInfo;
    if (!pageInfo.hasNextPage) {
      console.log(
        `[Pagination] Complete! Total issues fetched: ${allIssues.length} across ${pageCount} page(s)`
      );
      break;
    }

    after = pageInfo.endCursor;
  }

  return allIssues;
}

export async function getIssuesInState(teamId: string, stateId: string) {
  // OPTIMIZED: Use shared query from linearGraphQL.tsx (DRY principle)
  // Includes parent-child relationships with 1 level of nesting only

  let allIssues: any[] = [];
  let after: string | undefined = undefined;

  while (true) {
    const data = await executeLinearQuery(LINEAR_QUERIES.GET_ISSUES_IN_STATE, {
      teamId,
      stateId,
      after,
    });
    const issues = data.issues.nodes;
    allIssues = allIssues.concat(issues);

    const pageInfo = data.issues.pageInfo;
    if (!pageInfo.hasNextPage) break;

    after = pageInfo.endCursor;
  }

  return allIssues;
}

/**
 *NEW: Get issues grouped by parent relationship
 * Returns only parent issues (root level) with their sub-issues nested
 * This powers the Kanban board to show only top-level issues
 */
export async function getIssuesGroupedByParent(
  teamId: string,
  stateId: string
) {
  // First, get all issues in this state (including sub-issues)
  const allIssues = await getIssuesInState(teamId, stateId);

  console.log(
    `[Parent-Child] Processing ${allIssues.length} issues for grouping`
  );

  //STEP 1: Recursive function to count ALL descendants with detailed breakdown
  const countAllDescendants = (issue: any): number => {
    const childrenNodes = issue.children?.nodes || [];
    if (childrenNodes.length === 0) return 0;

    let totalCount = childrenNodes.length; // Direct children

    // Recursively count grandchildren, great-grandchildren, etc.
    childrenNodes.forEach((child: any) => {
      totalCount += countAllDescendants(child);
    });

    return totalCount;
  };

  //NEW: Calculate detailed hierarchy breakdown
  const calculateHierarchyBreakdown = (issue: any) => {
    const childrenNodes = issue.children?.nodes || [];

    const breakdown = {
      level1: 0, // Direct children
      level2: 0, // Grandchildren
      level3Plus: 0, // Great-grandchildren and deeper
      byState: {} as Record<string, number>,
      total: 0,
    };

    // Count level 1 (direct children)
    breakdown.level1 = childrenNodes.length;

    childrenNodes.forEach((child: any) => {
      const childState = child.state?.name || "unknown";
      breakdown.byState[childState] = (breakdown.byState[childState] || 0) + 1;

      // Count level 2 (grandchildren)
      const grandchildrenNodes = child.children?.nodes || [];
      breakdown.level2 += grandchildrenNodes.length;

      grandchildrenNodes.forEach((grandchild: any) => {
        const grandchildState = grandchild.state?.name || "unknown";
        breakdown.byState[grandchildState] =
          (breakdown.byState[grandchildState] || 0) + 1;

        // Count level 3+ (great-grandchildren and deeper)
        const greatGrandchildrenCount = countAllDescendants(grandchild);
        breakdown.level3Plus += greatGrandchildrenCount;
      });
    });

    breakdown.total =
      breakdown.level1 + breakdown.level2 + breakdown.level3Plus;
    return breakdown;
  };

  // Store DIRECT children count from Linear API (regardless of state)
  // CRITICAL: Use children.nodes.length from Linear API for TRUE sub-issue count
  console.log(
    `[Hierarchy Counter] Processing ${allIssues.length} issues to count descendants...`
  );
  allIssues.forEach((issue) => {
    const totalDescendants = countAllDescendants(issue);
    const hierarchyBreakdown = calculateHierarchyBreakdown(issue);

    // CRITICAL FIX: Use children.nodes.length from Linear API
    // This is the REAL number of direct children, regardless of their current state
    const directChildrenFromAPI = issue.children?.nodes?.length || 0;
    issue._originalSubIssueCount = directChildrenFromAPI;
    issue._hierarchyBreakdown = hierarchyBreakdown;

    console.log(
      `[Hierarchy] ${issue.identifier}: ${directChildrenFromAPI} direct children from API (total descendants: ${totalDescendants}, L1:${hierarchyBreakdown.level1}, L2:${hierarchyBreakdown.level2}, L3+:${hierarchyBreakdown.level3Plus})`
    );

    if (totalDescendants > 0) {
      // Log state distribution
      const stateDistribution = Object.entries(hierarchyBreakdown.byState)
        .map(([state, count]) => `${state}:${count}`)
        .join(", ");
      console.log(`   └─Distribution: ${stateDistribution}`);

      // Log direct children with their own child counts
      const childrenNodes = issue.children?.nodes || [];
      childrenNodes.forEach((child: any) => {
        const childDescendants = countAllDescendants(child);
        const childInfo =
          childDescendants > 0
            ? `${child.identifier} (${child.state?.name}, +${childDescendants} nested)`
            : `${child.identifier} (${child.state?.name})`;
        console.log(`   └─ ${childInfo}`);
      });
    }
  });

  // Create a map of all issues by ID for quick lookup
  //PRESERVE _originalSubIssueCount when creating map
  const issuesById: Record<string, any> = Object.fromEntries(
    allIssues.map((issue) => [
      issue.id,
      {
        ...issue,
        subIssues: [],
        _originalSubIssueCount: issue._originalSubIssueCount, //Preserve count
        _hierarchyBreakdown: issue._hierarchyBreakdown, //Preserve hierarchy breakdown
      },
    ])
  );

  const rootIssues: any[] = [];
  let subIssueCount = 0;

  //Build parent-child hierarchy map from original data
  // Map: issueId → parent issue object (from original allIssues)
  const originalParentMap: Record<string, any> = {};
  allIssues.forEach((issue) => {
    if (issue.parent?.id) {
      originalParentMap[issue.id] = issue.parent;
    }
  });

  //Helper: Check if issue is a nested sub-issue (grandchild or deeper)
  const isNestedSubIssue = (issue: any): boolean => {
    if (!issue.parent?.id) return false; // No parent = root issue

    const parentInSameState = issuesById[issue.parent.id];
    if (!parentInSameState) return false; // Parent not in same state

    // Check if parent itself has a parent that's also in this state
    const parentOriginalData = allIssues.find((i) => i.id === issue.parent.id);
    if (parentOriginalData?.parent?.id) {
      const grandparentInSameState = issuesById[parentOriginalData.parent.id];
      if (grandparentInSameState) {
        // Grandparent exists in same state = this is nested sub-issue (level 3+)
        console.log(
          `[Hierarchy] ${issue.identifier} is nested: parent=${parentOriginalData.identifier}, grandparent=${grandparentInSameState.identifier}`
        );
        return true;
      }
    }

    return false; // Direct child only
  };

  // First pass: identify root issues and sub-issues
  for (const issue of allIssues) {
    if (issue.parent?.id) {
      // This is a sub-issue
      const parent = issuesById[issue.parent.id];
      if (parent) {
        //Parent exists in this state

        //CRITICAL: Only add direct children, NOT nested sub-issues
        if (!isNestedSubIssue(issue)) {
          // Safe to nest - this is a direct child
          subIssueCount++;
          parent.subIssues.push(issue);
          console.log(
            `[Hierarchy] ${issue.identifier} → parent ${parent.identifier} (direct child)`
          );
        } else {
          // This is a nested sub-issue - do NOT display
          console.log(
            `[Hierarchy] ${issue.identifier} is nested sub-issue → HIDDEN from Kanban`
          );
        }
      } else {
        //Parent is in different state - treat as standalone root issue
        // This happens when sub-issue moves to different state than parent (e.g., approved to "Client Review")
        console.log(
          `[Parent-Child] ${issue.identifier} has parent ${issue.parent.identifier} in different state - showing as root`
        );
        rootIssues.push(issuesById[issue.id]);
      }
    } else {
      // This is a root issue (no parent)
      rootIssues.push(issuesById[issue.id]);
    }
  }

  console.log(
    `[Parent-Child] Grouped into ${rootIssues.length} root issues with ${subIssueCount} sub-issues`
  );

  //DEBUG: Log all root issues with their _originalSubIssueCount
  console.log(
    `[SubIssue Count] Verifying _originalSubIssueCount for ${rootIssues.length} root issues:`
  );
  rootIssues.forEach((issue) => {
    if (issue._originalSubIssueCount !== undefined) {
      console.log(
        `  ${issue.identifier}._originalSubIssueCount = ${issue._originalSubIssueCount}`
      );
    } else {
      console.log(
        `  [DEBUG] ${issue.identifier}._originalSubIssueCount = UNDEFINED (this is a BUG!)`
      );
    }
  });

  // Log parent issues with sub-issues for debugging
  const parentsWithChildren = rootIssues.filter(
    (issue) => issue.subIssues.length > 0
  );
  if (parentsWithChildren.length > 0) {
    console.log(
      `[Parent-Child] ${parentsWithChildren.length} issues have sub-issues:`
    );
    parentsWithChildren.forEach((parent) => {
      console.log(
        `   ${parent.identifier}: ${parent.subIssues.length} sub-issue(s)`
      );
    });
  }

  return rootIssues;
}

export async function getCustomerDeliverables(
  teamId: string,
  projectName: string,
  states: string[]
) {
  const query = `
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
          id
          identifier
          title
          description
          url
          priority
          priorityLabel
          estimate
          dueDate
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          creator {
            id
            name
            email
            avatarUrl
          }
          project {
            id
            name
            color
            icon
            description
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          createdAt
          updatedAt
          completedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let allIssues: any[] = [];
  let after: string | undefined = undefined;

  while (true) {
    const data = await executeLinearQuery(query, {
      teamId,
      projectName,
      states,
      after,
    });
    const issues = data.issues.nodes;
    allIssues = allIssues.concat(issues);

    const pageInfo = data.issues.pageInfo;
    if (!pageInfo.hasNextPage) break;

    after = pageInfo.endCursor;
  }

  return allIssues;
}

export async function getIssueDetail(
  issueId: string,
  options?: { bypassCache?: boolean }
) {
  const bypassCache = options?.bypassCache === true;

  // PERFORMANCE: Check cache first (2 minutes TTL for issue details)
  const cacheKey = `linear:issue-detail:${issueId}`;
  const cacheTTL = 120; // 2 minutes - balance between freshness and performance
  const startTime = Date.now();

  if (!bypassCache) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        // Check if cached data has the expected structure
        if (cached.data && cached.expiresAt) {
          if (cached.expiresAt > Date.now()) {
            const cacheTime = Date.now() - startTime;
            console.log(
              `[getIssueDetail] Cache HIT for ${issueId} (${cacheTime}ms)`
            );
            return cached.data;
          } else {
            console.log(`[getIssueDetail] Cache EXPIRED for ${issueId}`);
          }
        } else if (cached.expiresAt) {
          // Legacy format: direct data with expiresAt
          if (cached.expiresAt > Date.now()) {
            const cacheTime = Date.now() - startTime;
            console.log(
              `[getIssueDetail] Cache HIT (legacy) for ${issueId} (${cacheTime}ms)`
            );
            return cached;
          }
        }
      }
    } catch (error) {
      // Cache miss or error - continue to fetch from API
      console.log(
        `[getIssueDetail] Cache MISS for ${issueId}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  } else {
    console.log(`[getIssueDetail] Bypass cache requested for ${issueId}`);
  }

  console.log(`[getIssueDetail] Fetching from Linear API for ${issueId}...`);
  const apiStartTime = Date.now();

  // OPTIMIZED: Use shared query from linearGraphQL.tsx (DRY principle)
  // Includes full details: comments, attachments, children
  const data = await executeLinearQuery(LINEAR_QUERIES.GET_ISSUE_DETAIL, {
    issueId,
  });

  const apiTime = Date.now() - apiStartTime;
  console.log(
    `[getIssueDetail] Linear API response for ${issueId}: ${apiTime}ms`
  );

  // Transform children.nodes to subIssues for consistency with grouped API
  if (data.issue && data.issue.children) {
    data.issue.subIssues = data.issue.children.nodes || [];
    delete data.issue.children;
  }

  // ALWAYS cache the result (even when bypassing cache read)
  // This ensures fresh data from bypassCache requests updates the cache for subsequent reads
  try {
    await kv.set(cacheKey, {
      data: data.issue,
      expiresAt: Date.now() + cacheTTL * 1000,
    });
    console.log(
      `[getIssueDetail] Cached ${issueId} for ${cacheTTL}s${
        bypassCache ? " (after bypass fetch)" : ""
      }`
    );
  } catch (error) {
    // Cache write failed - continue anyway
    console.warn(
      `[getIssueDetail] Failed to cache ${issueId}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  const totalTime = Date.now() - startTime;
  console.log(
    `[getIssueDetail] Total time for ${issueId}: ${totalTime}ms (API: ${apiTime}ms)`
  );

  return data.issue;
}

export async function searchIssues(query: string) {
  const graphqlQuery = `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 50) {
        nodes {
          id
          identifier
          title
          state {
            name
          }
          project {
            name
          }
          assignee {
            name
          }
          updatedAt
        }
      }
    }
  `;

  const data = await executeLinearQuery(graphqlQuery, {
    query,
  });
  return data.issueSearch.nodes;
}

/**
 *NEW: Get team issues pre-grouped by workflow states
 * Optimized single-call endpoint for Kanban boards
 *
 * @param teamId - Linear team ID
 * @returns {
 *   team: { id, name, key },
 *   states: [{ state: {...}, issues: [...], totalCount, rootCount, subIssueCount }],
 *   totalIssues: number,
 *   timestamp: string
 * }
 */
export async function getTeamIssuesByState(teamId: string) {
  console.log(
    `[IssuesByState] Fetching team ${teamId} with issues grouped by state`
  );

  try {
    // Step 1: Get team config (includes all states)
    const teamConfig = await getTeamConfig(teamId);

    if (!teamConfig) {
      throw new Error(`Team ${teamId} not found or has no configuration`);
    }

    console.log(
      `[IssuesByState] Team: ${teamConfig.name} (${teamConfig.key}) - ${
        teamConfig.states?.length || 0
      } states`
    );

    // Step 2: Get all issues for each state with parent-child grouping
    const states = teamConfig.states || [];
    const stateResults = await Promise.all(
      states.map(async (state: any) => {
        const rootIssues = await getIssuesGroupedByParent(teamId, state.id);

        // Calculate counts
        const subIssueCount = rootIssues.reduce(
          (sum, issue) => sum + (issue.subIssues?.length || 0),
          0
        );

        return {
          state: {
            id: state.id,
            name: state.name,
            type: state.type,
            color: state.color,
            position: state.position,
          },
          issues: rootIssues,
          totalCount: rootIssues.length + subIssueCount,
          rootCount: rootIssues.length,
          subIssueCount: subIssueCount,
        };
      })
    );

    // Calculate total issues
    const totalIssues = stateResults.reduce(
      (sum, stateData) => sum + stateData.totalCount,
      0
    );

    console.log(
      `[IssuesByState] Total: ${totalIssues} issues across ${states.length} states`
    );

    // Log breakdown by state
    stateResults.forEach((stateData) => {
      if (stateData.rootCount > 0) {
        console.log(
          `  ${stateData.state.name}: ${stateData.rootCount} root, ${stateData.subIssueCount} sub-issues`
        );
      }
    });

    return {
      team: {
        id: teamConfig.id,
        name: teamConfig.name,
        key: teamConfig.key,
      },
      states: stateResults,
      totalIssues,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[IssuesByState] Error fetching team ${teamId}:`, error);
    throw error;
  }
}

/**
 * Mutation Functions
 */

export async function updateIssueState(issueId: string, stateId: string) {
  const mutation = `
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
  `;

  const data = await executeLinearQuery(mutation, {
    issueId,
    stateId,
  });

  // PERFORMANCE: Invalidate cache when issue is updated
  try {
    await kv.del(`linear:issue-detail:${issueId}`);
  } catch (error) {
    // Cache invalidation failed - continue anyway
  }

  return data.issueUpdate;
}

export async function addComment(issueId: string, body: string) {
  const mutation = `
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
  `;

  const data = await executeLinearQuery(mutation, {
    issueId,
    body,
  });

  // PERFORMANCE: Invalidate cache when comment is added
  try {
    await kv.del(`linear:issue-detail:${issueId}`);
  } catch (error) {
    // Cache invalidation failed - continue anyway
  }

  return data.commentCreate;
}

export async function addLabel(issueId: string, labelId: string) {
  const mutation = `
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
  `;

  const data = await executeLinearQuery(mutation, {
    issueId,
    labelId,
  });
  return data.issueAddLabel;
}

/**
 * Request file upload credentials from Linear GraphQL API
 * Returns uploadUrl, assetUrl, and required headers
 */
async function requestLinearFileUpload(
  contentType: string,
  filename: string,
  size: number
) {
  console.log(
    `[Linear] Requesting upload credentials for: ${filename} (${size} bytes)`
  );

  const mutation = `
    mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile {
          uploadUrl
          assetUrl
          headers {
            key
            value
          }
        }
      }
    }
  `;

  const data = await executeLinearQuery(mutation, {
    contentType,
    filename,
    size,
  });

  if (!data.fileUpload?.success || !data.fileUpload?.uploadFile) {
    console.error("[Linear] Invalid fileUpload response:", data);
    throw new Error("Failed to request upload URL from Linear");
  }

  console.log(`[Linear] Got upload credentials for: ${filename}`);
  console.log(`[Linear] Asset URL: ${data.fileUpload.uploadFile.assetUrl}`);

  return data.fileUpload.uploadFile;
}

/**
 * Upload file to Linear storage
 * Follows Linear SDK pattern: fileUpload → PUT to uploadUrl → returns assetUrl
 */
async function uploadFileToLinear(file: File): Promise<string> {
  console.log(`[Linear] Starting file upload: ${file.name}`);

  // Step 1: Request upload credentials from Linear
  const uploadPayload = await requestLinearFileUpload(
    file.type || "application/octet-stream",
    file.name,
    file.size
  );

  const uploadUrl = uploadPayload.uploadUrl;
  const assetUrl = uploadPayload.assetUrl;

  // Step 2: Build headers (Content-Type + Cache-Control + Linear headers)
  const headers = new Headers();
  headers.set("Content-Type", file.type || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000");

  // Copy headers from Linear response
  if (uploadPayload.headers && Array.isArray(uploadPayload.headers)) {
    uploadPayload.headers.forEach((header: { key: string; value: string }) => {
      headers.set(header.key, header.value);
    });
  }

  console.log(`[Linear] Uploading to Linear storage...`);

  // Step 3: Upload file to Linear's uploadUrl
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("[Linear] Upload failed:", {
      status: uploadResponse.status,
      error: errorText,
    });
    throw new Error(
      `Failed to upload file to Linear: ${uploadResponse.status}`
    );
  }

  console.log(`[Linear] File uploaded successfully: ${file.name}`);
  console.log(`[Linear] Asset URL: ${assetUrl}`);

  // Return assetUrl to use in attachmentCreate
  return assetUrl;
}

export async function updateIssueAssignee(issueId: string, assigneeId: string) {
  const mutation = `
    mutation UpdateIssueAssignee($issueId: String!, $assigneeId: String!) {
      issueUpdate(id: $issueId, input: { assigneeId: $assigneeId }) {
        success
        issue {
          id
          assignee {
            id
            name
            email
            avatarUrl
          }
        }
      }
    }
  `;

  const data = await executeLinearQuery(mutation, {
    issueId,
    assigneeId,
  });
  return data.issueUpdate;
}

export async function updateIssuePriority(issueId: string, priority: number) {
  const mutation = `
    mutation UpdateIssuePriority($issueId: String!, $priority: Int!) {
      issueUpdate(id: $issueId, input: { priority: $priority }) {
        success
        issue {
          id
          priority
          priorityLabel
        }
      }
    }
  `;

  const data = await executeLinearQuery(mutation, {
    issueId,
    priority,
  });
  return data.issueUpdate;
}

/**
 * 🆕 Create Sub-Issue (Child Issue)
 * Creates a new issue as a sub-task of an existing parent issue
 *
 * ️ CRITICAL: teamId is REQUIRED by Linear API!
 * The parent issue's team will be used for the sub-issue
 */
export async function createSubIssue(
  parentIssueId: string,
  title: string,
  description?: string
) {
  console.log(`[Linear] Creating sub-issue for parent: ${parentIssueId}`);

  // STEP 1: Get parent issue to extract teamId and cycleId
  const parentQuery = `
    query GetParentIssue($issueId: String!) {
      issue(id: $issueId) {
        id
        identifier
        title
        cycle {
          id
          name
        }
        team {
          id
          name
        }
      }
    }
  `;

  const parentData = await executeLinearQuery(parentQuery, {
    issueId: parentIssueId,
  });

  if (!parentData?.issue) {
    throw new Error(`Parent issue not found: ${parentIssueId}`);
  }

  const teamId = parentData.issue.team?.id;
  if (!teamId) {
    throw new Error(`Parent issue ${parentIssueId} has no team assigned`);
  }

  const cycleId = parentData.issue.cycle?.id;
  console.log(
    `[Linear] Parent team: ${parentData.issue.team.name}, cycle: ${
      cycleId ? parentData.issue.cycle.name : "none"
    }`
  );

  // STEP 2: Get Triage state for the team
  const teamStatesQuery = `
    query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;

  const teamStatesData = await executeLinearQuery(teamStatesQuery, { teamId });
  const triageState = teamStatesData?.team?.states?.nodes?.find(
    (state: any) => state.name.toLowerCase() === "triage"
  );
  const stateId = triageState?.id;

  if (stateId) {
    console.log(`[Linear] Found Triage state: ${stateId}`);
  } else {
    console.log(`[Linear] Warning: Triage state not found for team ${teamId}`);
  }

  // STEP 3: Get UAT and Client-Submitted labels for the team
  const teamLabelsQuery = `
    query GetTeamLabels($teamId: String!) {
      team(id: $teamId) {
        labels {
          nodes {
            id
            name
          }
        }
      }
    }
  `;

  const teamLabelsData = await executeLinearQuery(teamLabelsQuery, { teamId });
  const labels = teamLabelsData?.team?.labels?.nodes || [];

  const uatLabel = labels.find(
    (label: any) => label.name.toLowerCase() === "uat"
  );
  const clientSubmittedLabel = labels.find(
    (label: any) => label.name.toLowerCase() === "client-submitted"
  );

  const labelIds: string[] = [];
  if (uatLabel) {
    labelIds.push(uatLabel.id);
    console.log(`[Linear] Found UAT label: ${uatLabel.id}`);
  }
  if (clientSubmittedLabel) {
    labelIds.push(clientSubmittedLabel.id);
    console.log(
      `[Linear] Found Client-Submitted label: ${clientSubmittedLabel.id}`
    );
  }

  // STEP 4: Create sub-issue with all inherited properties
  const mutation = `
    mutation CreateSubIssue(
      $title: String!, 
      $description: String, 
      $teamId: String!, 
      $parentId: String!,
      $cycleId: String,
      $stateId: String,
      $labelIds: [String!]
    ) {
      issueCreate(input: { 
        title: $title
        description: $description
        teamId: $teamId
        parentId: $parentId
        cycleId: $cycleId
        stateId: $stateId
        labelIds: $labelIds
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
          cycle {
            id
            name
          }
          state {
            id
            name
          }
          labels {
            nodes {
              id
              name
            }
          }
          team {
            id
            name
          }
        }
      }
    }
  `;

  const data = await executeLinearQuery(mutation, {
    title,
    description: description || "",
    teamId,
    parentId: parentIssueId,
    cycleId: cycleId || null,
    stateId: stateId || null,
    labelIds: labelIds.length > 0 ? labelIds : null,
  });

  if (!data.issueCreate?.success) {
    throw new Error("Failed to create sub-issue in Linear");
  }

  const createdIssue = data.issueCreate.issue;
  console.log(`[Linear] Sub-issue created: ${createdIssue.identifier}`, {
    parentId: parentIssueId,
    cycleId: createdIssue.cycle?.id,
    stateId: createdIssue.state?.id,
    stateName: createdIssue.state?.name,
    labels:
      createdIssue.labels?.nodes?.map((l: any) => l.name).join(", ") || "none",
  });

  // CRITICAL FIX: Return issue object directly, not wrapper
  // Frontend expects { id, identifier, title, ... } not { success: true, issue: {...} }
  return createdIssue;
}

/**
 *Upload Files to Issue
 * Uploads files to Supabase Storage and attaches URLs to Linear issue
 *
 * @param issueId - Linear issue ID
 * @param files - Array of File objects
 */
/**
 * Upload files to Linear and attach to issue
 * Uses Linear's native fileUpload GraphQL mutation
 */
export async function uploadFilesToIssue(issueId: string, files: File[]) {
  console.log(`[Linear] Starting uploadFilesToIssue for issue: ${issueId}`);
  console.log(`[Linear] Files count: ${files.length}`);
  console.log(
    `[Linear] Files details:`,
    files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }))
  );

  if (!files || files.length === 0) {
    throw new Error("No files provided to upload");
  }

  const assetUrls: string[] = [];
  const errors: string[] = [];

  // Step 1: Upload each file to Linear storage
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      console.log(
        `[Linear] Processing file ${i + 1}/${files.length}: ${file.name}`
      );

      // Upload to Linear storage (fileUpload mutation → PUT to uploadUrl)
      const assetUrl = await uploadFileToLinear(file);

      assetUrls.push(assetUrl);
      console.log(`[Linear] File uploaded: ${file.name}`);
    } catch (error) {
      const errorMsg = `Failed to upload ${file.name}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[Linear] ${errorMsg}`);
      console.error(
        `[Linear] Error stack:`,
        error instanceof Error ? error.stack : "No stack"
      );
      errors.push(errorMsg);
      // Continue with other files
    }
  }

  // Check if we uploaded any files
  if (assetUrls.length === 0) {
    const errorSummary =
      errors.length > 0
        ? `Failed to upload any files to Linear. Errors: ${errors.join("; ")}`
        : "Failed to upload any files to Linear. No errors captured.";
    console.error(`[Linear] ${errorSummary}`);
    throw new Error(errorSummary);
  }

  console.log(
    `[Linear] Successfully uploaded ${assetUrls.length}/${files.length} files to Linear storage`
  );
  if (errors.length > 0) {
    console.warn(`[Linear] ${errors.length} files failed:`, errors);
  }

  // Step 2: Attach all assetUrls to Linear issue
  const attachments: { id: string; title: string; url: string }[] = [];
  const attachErrors: string[] = [];

  for (let i = 0; i < assetUrls.length; i++) {
    const assetUrl = assetUrls[i];
    const fileName = files[i].name;

    try {
      console.log(
        `[Linear] Attaching ${i + 1}/${assetUrls.length}: ${fileName}`
      );

      // Attach assetUrl to issue via attachmentCreate
      const mutation = `
        mutation AttachUrl($issueId: String!, $url: String!, $title: String!) {
          attachmentCreate(input: { issueId: $issueId, url: $url, title: $title }) {
            success
            attachment {
              id
              title
              url
            }
          }
        }
      `;

      const data = await executeLinearQuery(mutation, {
        issueId,
        url: assetUrl,
        title: fileName,
      });

      if (!data.attachmentCreate?.success) {
        throw new Error("attachmentCreate returned success: false");
      }

      attachments.push({
        id: data.attachmentCreate.attachment.id,
        title: data.attachmentCreate.attachment.title,
        url: data.attachmentCreate.attachment.url,
      });

      console.log(`[Linear] Attached to issue: ${fileName}`);
    } catch (error) {
      const errorMsg = `Failed to attach ${fileName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[Linear] ${errorMsg}`);
      attachErrors.push(errorMsg);
      // Continue with other attachments
    }
  }

  // Final check
  if (attachments.length === 0) {
    const errorSummary = `Failed to attach any files to issue. Errors: ${attachErrors.join(
      "; "
    )}`;
    console.error(`[Linear] ${errorSummary}`);
    throw new Error(errorSummary);
  }

  console.log(
    `[Linear] Successfully attached ${attachments.length}/${assetUrls.length} files to issue`
  );
  if (attachErrors.length > 0) {
    console.warn(
      `[Linear] ${attachErrors.length} attachments failed:`,
      attachErrors
    );
  }

  return attachments;
}

/**
 * Utility Functions
 */

/**
 *Build Issue Hierarchy Tree
 * Transforms flat issue list into a tree structure with parent-child relationships
 *
 * @param issuesByState - Issues grouped by state ID
 * @param teamConfig - Team configuration with states metadata
 * @returns Hierarchical tree structure with state metadata and nested issues
 */
export function buildIssueHierarchy(
  issuesByState: Record<string, any[]>,
  teamConfig: any
) {
  const tree: Record<string, any> = {};

  Object.entries(issuesByState).forEach(([stateId, issues]) => {
    // Find state metadata
    const stateInfo = teamConfig.states?.find((s: any) => s.id === stateId);

    tree[stateId] = {
      stateName: stateInfo?.name || "Unknown",
      stateType: stateInfo?.type || "unknown",
      stateColor: stateInfo?.color || "#gray",
      statePosition: stateInfo?.position || 0,
      totalIssues: issues.length,
      totalWithSubIssues: issues.reduce(
        (sum, issue) => sum + 1 + (issue.subIssues?.length || 0),
        0
      ),
      issues: issues.map((issue) => ({
        // Core issue data
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        url: issue.url,

        // Status and progress
        state: {
          id: issue.state?.id,
          name: issue.state?.name,
          type: issue.state?.type,
          color: issue.state?.color,
        },

        // Priority and metadata
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        estimate: issue.estimate,
        dueDate: issue.dueDate,

        // Assignment
        assignee: issue.assignee
          ? {
              id: issue.assignee.id,
              name: issue.assignee.name,
              email: issue.assignee.email,
              avatarUrl: issue.assignee.avatarUrl,
            }
          : null,

        // Creator
        creator: issue.creator
          ? {
              id: issue.creator.id,
              name: issue.creator.name,
              email: issue.creator.email,
            }
          : null,

        // Parent-child relationship
        hasParent: !!issue.parent,
        parent: issue.parent
          ? {
              id: issue.parent.id,
              identifier: issue.parent.identifier,
              title: issue.parent.title,
            }
          : null,

        // Sub-issues (children)
        hasChildren: (issue.subIssues?.length || 0) > 0,
        childrenCount: issue.subIssues?.length || 0,
        children: (issue.subIssues || []).map((sub: any) => ({
          id: sub.id,
          identifier: sub.identifier,
          title: sub.title,
          state: {
            id: sub.state?.id,
            name: sub.state?.name,
            type: sub.state?.type,
            color: sub.state?.color,
          },
          priority: sub.priority,
          priorityLabel: sub.priorityLabel,
          assignee: sub.assignee
            ? {
                id: sub.assignee.id,
                name: sub.assignee.name,
                avatarUrl: sub.assignee.avatarUrl,
              }
            : null,
          estimate: sub.estimate,
          dueDate: sub.dueDate,
          url: sub.url,
        })),

        // Computed metrics
        completionRate:
          issue.subIssues?.length > 0
            ? (issue.subIssues.filter((s: any) => s.state?.type === "completed")
                .length /
                issue.subIssues.length) *
              100
            : null,

        // Timestamps
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,

        // Labels and project
        labels: issue.labels || [],
        project: issue.project
          ? {
              id: issue.project.id,
              name: issue.project.name,
              color: issue.project.color,
            }
          : null,
      })),
    };
  });

  return tree;
}

/**
 *Get Issues By State with Hierarchy Support
 *
 * @param teamId - Linear team ID
 * @param mode - "flat" (default, backward compatible) or "tree" (hierarchy structure)
 * @returns Issues grouped by state, optionally with hierarchy metadata
 */
// ️ DEPRECATED: Use getTeamIssuesByState() instead
// This method fetches issues for each state individually (slow)
// New method fetches all issues once and groups them (fast)
// Keeping for backward compatibility temporarily - will be removed
export async function getIssuesByState(
  teamId: string,
  mode: "flat" | "tree" = "flat"
) {
  console.warn(
    "️ DEPRECATED: getIssuesByState() is deprecated. Use getTeamIssuesByState() instead."
  );

  // Redirect to new optimized method
  const result = await getTeamIssuesByState(teamId);

  if (!result) {
    return mode === "tree" ? {} : {};
  }

  // Transform new format to old format for backward compatibility
  const issuesByState: Record<string, any[]> = {};
  result.states.forEach((stateData: any) => {
    issuesByState[stateData.state.id] = stateData.issues;
  });

  if (mode === "tree") {
    // Build tree structure if needed
    const teamConfig = {
      id: result.team.id,
      name: result.team.name,
      key: result.team.key,
      states: result.states.map((s: any) => s.state),
    };
    return buildIssueHierarchy(issuesByState, teamConfig);
  }

  return issuesByState;
}

export async function getGuillevinIssues(teamId: string) {
  // EXACT LINEAR STATE NAMES (based on Linear workflow images)
  const states = [
    "Client Review", // Issues awaiting client review
    "Release Ready", // Ready for deployment, approved by client
    "Shipped", // Successfully deployed to production
    "Needs Input", // Blocked waiting for client input
    "Failed Review", // Review failed, needs changes
  ];

  const issues = await getCustomerDeliverables(
    teamId,
    "Electrical Distribution Platform",
    states
  );

  return {
    // Map Linear states to client review categories
    pendingReview: issues.filter((i: any) => i.state.name === "Client Review"),
    approved: issues.filter((i: any) => i.state.name === "Release Ready"),
    released: issues.filter((i: any) => i.state.name === "Shipped"),
    needsInput: issues.filter((i: any) => i.state.name === "Needs Input"),
    failedReview: issues.filter((i: any) => i.state.name === "Failed Review"),
  };
}

export async function validateTeamAccess(teamId: string) {
  try {
    const team = await getTeamConfig(teamId);
    return {
      hasAccess: true,
      team,
    };
  } catch (error) {
    return {
      hasAccess: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getIssueStatistics(teamId: string) {
  const issues = await getAllTeamIssues(teamId);

  const stats = {
    total: issues.length,
    byState: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    byAssignee: {} as Record<string, number>,
  };

  issues.forEach((issue: any) => {
    // Count by state
    const stateName = issue.state.name;
    stats.byState[stateName] = (stats.byState[stateName] || 0) + 1;

    // Count by priority
    const priority = issue.priorityLabel || "No Priority";
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

    // Count by assignee
    const assignee = issue.assignee?.name || "Unassigned";
    stats.byAssignee[assignee] = (stats.byAssignee[assignee] || 0) + 1;
  });

  return stats;
}

/**
 *LIGHTWEIGHT: Get workflow state ID by name
 * Perfect for approve button - no need to load full team config
 * @param teamId - Linear team ID
 * @param stateName - State name to find (e.g., "Client Review")
 * @returns State ID or null if not found
 */
export async function getStateIdByName(
  teamId: string,
  stateName: string
): Promise<string | null> {
  try {
    console.log(
      `[Linear] Finding state ID for: "${stateName}" in team ${teamId}`
    );

    const query = `
      query GetTeamWorkflowStates($teamId: String!) {
        team(id: $teamId) {
          id
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `;

    const data = await executeLinearQuery(query, { teamId });

    if (!data?.team?.states?.nodes) {
      console.error("[Linear] No states found in team");
      return null;
    }

    const states = data.team.states.nodes;
    console.log(`[Linear] Found ${states.length} workflow states`);

    // Case-insensitive search
    const targetState = states.find(
      (state: any) => state.name.toLowerCase() === stateName.toLowerCase()
    );

    if (targetState) {
      console.log(
        `[Linear] Found state: ${targetState.name} → ${targetState.id}`
      );
      return targetState.id;
    } else {
      console.warn(
        `️ [Linear] State "${stateName}" not found in team ${teamId}`
      );
      console.log(
        "Available states:",
        states.map((s: any) => s.name).join(", ")
      );
      return null;
    }
  } catch (error) {
    console.error("[Linear] Error fetching state ID:", error);
    return null;
  }
}

/**
 * Create Parent Acceptance Issue (NO parentId)
 * Creates a new top-level issue in Linear for a team
 *
 * This is different from createSubIssue() which creates child tasks
 *
 * @param params - Issue creation parameters
 * @returns Created issue data
 */
export async function createIssue(params: {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
  stateId?: string;
  labelIds?: string[];
  cycleId?: string;
  parentId?: string;
}) {
  const {
    teamId,
    title,
    description,
    priority,
    assigneeId,
    stateId,
    labelIds,
    parentId,
  } = params;
  let { cycleId } = params;

  const issueType = parentId ? "sub-issue" : "parent issue";
  console.log(`[Linear] Creating ${issueType}:`, {
    teamId,
    title,
    hasPriority: priority !== undefined,
    hasAssignee: !!assigneeId,
    hasState: !!stateId,
    labelCount: labelIds?.length || 0,
    cycleIdProvided: !!cycleId,
    hasParent: !!parentId,
  });

  // STEP 1: Auto-fetch active UAT cycle if not provided
  if (!cycleId) {
    console.log("[Linear] No cycleId provided, fetching active UAT cycle...");

    const cycleQuery = `
      query GetActiveCycle($teamId: String!) {
        team(id: $teamId) {
          cycles(
            filter: { 
              isActive: { eq: true }
            }
            first: 10
          ) {
            nodes {
              id
              name
              startsAt
              endsAt
            }
          }
        }
      }
    `;

    try {
      const cycleData = await executeLinearQuery(cycleQuery, { teamId });
      const activeCycles = cycleData.team?.cycles?.nodes || [];

      // Find UAT cycle (contains "UAT" in name)
      const uatCycle = activeCycles.find((c: any) =>
        c.name.toLowerCase().includes("uat")
      );

      if (uatCycle) {
        cycleId = uatCycle.id;
        console.log("[Linear] Found active UAT cycle:", {
          id: uatCycle.id,
          name: uatCycle.name,
        });
      } else {
        // Fallback to first active cycle
        if (activeCycles.length > 0) {
          cycleId = activeCycles[0].id;
          console.log("[Linear] Using first active cycle:", {
            id: activeCycles[0].id,
            name: activeCycles[0].name,
          });
        } else {
          console.log(
            "[Linear] No active cycle found, proceeding without cycle"
          );
        }
      }
    } catch (err) {
      console.error("[Linear] Failed to fetch active cycle:", err);
      console.log("[Linear] Proceeding without cycle");
    }
  }

  const mutation = `
    mutation CreateIssue(
      $teamId: String!
      $title: String!
      $description: String
      $priority: Int
      $assigneeId: String
      $stateId: String
      $labelIds: [String!]
      $cycleId: String
      $parentId: String
    ) {
      issueCreate(input: {
        teamId: $teamId
        title: $title
        description: $description
        priority: $priority
        assigneeId: $assigneeId
        stateId: $stateId
        labelIds: $labelIds
        cycleId: $cycleId
        parentId: $parentId
      }) {
        success
        issue {
          id
          identifier
          title
          description
          url
          priority
          priorityLabel
          state {
            id
            name
            type
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          cycle {
            id
            name
          }
          team {
            id
            name
            key
          }
          createdAt
          updatedAt
        }
      }
    }
  `;

  // Build variables object, excluding null values (Linear API doesn't accept null)
  const variables: Record<string, any> = {
    teamId,
    title,
  };

  // Only add optional fields if they have actual values
  if (description) variables.description = description;
  if (priority !== undefined) variables.priority = priority;
  if (assigneeId) variables.assigneeId = assigneeId;
  if (stateId) variables.stateId = stateId;
  if (labelIds && labelIds.length > 0) variables.labelIds = labelIds;
  if (cycleId) variables.cycleId = cycleId;
  if (parentId) variables.parentId = parentId;

  const data = await executeLinearQuery(mutation, variables);

  if (!data.issueCreate?.success) {
    throw new Error("Failed to create issue in Linear");
  }

  const createdIssue = data.issueCreate.issue;
  console.log(`[Linear] ${issueType} created:`, {
    identifier: createdIssue.identifier,
    id: createdIssue.id,
    state: createdIssue.state?.name,
    priority: createdIssue.priorityLabel,
    labels:
      createdIssue.labels?.nodes?.map((l: any) => l.name).join(", ") || "none",
    parentId: parentId || "none",
  });

  return {
    success: true,
    data: createdIssue,
  };
}

/**
 * Get team issues (alias for getTeamIssuesByState for backward compatibility)
 */
export async function getTeamIssues(teamId: string) {
  return await getTeamIssuesByState(teamId);
}

/**
 * Invalidate cache for a specific team
 */
export async function invalidateCache(teamId: string) {
  try {
    // Invalidate issue detail cache for all issues in this team
    const allIssues = await getAllTeamIssues(teamId);
    const cacheKeys = allIssues.map(
      (issue) => `linear:issue-detail:${issue.id}`
    );

    // Delete all cache keys
    for (const key of cacheKeys) {
      try {
        await kv.del(key);
      } catch (error) {
        // Ignore individual cache deletion errors
      }
    }

    return {
      success: true,
      message: `Invalidated cache for ${cacheKeys.length} issues in team ${teamId}`,
      invalidatedCount: cacheKeys.length,
    };
  } catch (error) {
    console.error(
      `[invalidateCache] Error invalidating cache for team ${teamId}:`,
      error
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to invalidate cache",
    };
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    // Get all cache keys with prefix
    const cacheKeys = await kv.getByPrefix("linear:issue-detail:");

    let totalSize = 0;
    let validCaches = 0;
    let expiredCaches = 0;

    // Check each cache entry
    for (const key of cacheKeys) {
      try {
        const cached = await kv.get(key);
        if (cached) {
          if (cached.expiresAt && cached.expiresAt > Date.now()) {
            validCaches++;
          } else {
            expiredCaches++;
          }
          // Estimate size (rough calculation)
          totalSize += JSON.stringify(cached).length;
        }
      } catch (error) {
        // Ignore individual cache read errors
      }
    }

    return {
      success: true,
      data: {
        totalCaches: cacheKeys.length,
        validCaches,
        expiredCaches,
        estimatedSize: totalSize,
        estimatedSizeKB: Math.round(totalSize / 1024),
      },
    };
  } catch (error) {
    console.error("[getCacheStats] Error getting cache stats:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get cache stats",
    };
  }
}
