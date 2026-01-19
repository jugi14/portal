/**
 *Issue Routes - Teifi Client Portal
 *
 * Linear issue management with caching
 * Wrapper cho linearTeamIssuesService
 *
 * @module issueRoutes
 */

import { Hono } from "hono";
import { authMiddleware } from "../authHelpers";
import * as linearTeamIssuesService from "../services/linearTeamIssuesService";
import { teamMethodsV2 } from "../methods/teamMethodsV2";

export const issueRoutes = new Hono();

// Apply auth middleware to all routes
issueRoutes.use("*", authMiddleware);

// ==================================================
// ISSUE QUERIES
// ==================================================

/**
 * GET /issues/team/:teamId
 * Get all issues for a team
 */
issueRoutes.get("/issues/team/:teamId", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");


    // Check team access
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId,
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied to this team" },
        { status: 403 },
      );
    }

    const result =
      await linearTeamIssuesService.getTeamIssues(teamId);

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Issues] Get team issues error:", error);
    return c.json(
      { success: false, error: "Failed to fetch team issues" },
      { status: 500 },
    );
  }
});

/**
 * GET /issues/team/:teamId/by-state
 * Get issues grouped by state
 */
issueRoutes.get("/issues/team/:teamId/by-state", async (c) => {
  try {
    const user = c.get("user");
    const teamId = c.req.param("teamId");
    // Check team access
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId,
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied to this team" },
        { status: 403 },
      );
    }

    const result =
      await linearTeamIssuesService.getTeamIssuesByState(
        teamId,
      );

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Failed to fetch issues by state",
        },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Issues] Get issues by state error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch issues by state",
      },
      { status: 500 },
    );
  }
});

/**
 * GET /issues/:issueId
 * Get single issue details
 */
issueRoutes.get("/issues/:issueId", async (c) => {
  try {
    const user = c.get("user");
    const issueId = c.req.param("issueId");
    const bypassCache = c.req.query("bypassCache") === "true";


    const issue =
      await linearTeamIssuesService.getIssueDetail(issueId, {
        bypassCache,
      });

    if (!issue) {
      return c.json(
        { success: false, error: "Issue not found" },
        { status: 404 },
      );
    }

    // TODO: Add team access check for the issue's team

    const response = {
      success: true,
      data: {
        issue: issue
      },
    };
    return c.json(response);
  } catch (error) {
    console.error("[Issues] Get issue error:", error);
    return c.json(
      { success: false, error: "Failed to fetch issue" },
      { status: 500 },
    );
  }
});

// ==================================================
// ISSUE MUTATIONS
// ==================================================

/**
 * PUT /issues/:issueId/state
 * Update issue state
 */
issueRoutes.put("/issues/:issueId/state", async (c) => {
  try {
    const user = c.get("user");
    const issueId = c.req.param("issueId");
    const body = await c.req.json();
    const { stateId } = body;
    if (!stateId) {
      return c.json(
        { success: false, error: "stateId is required" },
        { status: 400 },
      );
    }

    const result =
      await linearTeamIssuesService.updateIssueState(
        issueId,
        stateId,
      );

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return c.json({
      success: true,
      data: result.data,
      message: "Issue state updated successfully",
    });
  } catch (error) {
    console.error("[Issues] Update issue state error:", error);
    return c.json(
      { success: false, error: "Failed to update issue state" },
      { status: 500 },
    );
  }
});

/**
 * POST /issues/create
 * Create a new parent issue
 */
issueRoutes.post("/issues/create", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const {
      teamId,
      title,
      description,
      priority,
      stateId,
      assigneeId,
      labelIds,
      cycleId,
    } = body;
    if (!teamId || !title) {
      return c.json(
        {
          success: false,
          error: "teamId and title are required",
        },
        { status: 400 },
      );
    }

    // Check team access
    const accessCheck = await teamMethodsV2.checkUserTeamAccess(
      user.id,
      teamId,
    );
    if (!accessCheck.success) {
      return c.json(
        { success: false, error: "Access denied to this team" },
        { status: 403 },
      );
    }

    const result = await linearTeamIssuesService.createIssue({
      teamId,
      title,
      description,
      priority,
      stateId,
      assigneeId,
      labelIds,
      cycleId,
    });

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Issues] Create issue error:", error);
    return c.json(
      { success: false, error: "Failed to create issue" },
      { status: 500 },
    );
  }
});

/**
 * POST /issues/:parentIssueId/sub-issues
 * Create a sub-issue (child issue) for a parent issue
 */
issueRoutes.post("/issues/:parentIssueId/sub-issues", async (c) => {
  try {
    const user = c.get("user");
    const parentIssueId = c.req.param("parentIssueId");
    const body = await c.req.json();
    const { title, description } = body;


    if (!title) {
      return c.json(
        { success: false, error: "title is required" },
        { status: 400 },
      );
    }

    // Create sub-issue using service
    const result = await linearTeamIssuesService.createSubIssue(
      parentIssueId,
      title,
      description,
    );
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Issues] Create sub-issue error:", error);
    return c.json(
      { success: false, error: "Failed to create sub-issue" },
      { status: 500 },
    );
  }
});

// ==================================================
// CACHE MANAGEMENT
// ==================================================

/**
 * POST /issues/cache/invalidate
 * Invalidate issue cache
 */
issueRoutes.post("/issues/cache/invalidate", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { teamId } = body;
    const result =
      await linearTeamIssuesService.invalidateCache(teamId);

    return c.json({
      success: true,
      message: "Cache invalidated successfully",
    });
  } catch (error) {
    console.error("[Issues] Invalidate cache error:", error);
    return c.json(
      { success: false, error: "Failed to invalidate cache" },
      { status: 500 },
    );
  }
});

/**
 * GET /issues/cache/stats
 * Get cache statistics
 */
issueRoutes.get("/issues/cache/stats", async (c) => {
  try {
    const user = c.get("user");
    const role = c.get("role");

    // Only admin/superadmin can view cache stats
    if (role !== "admin" && role !== "superadmin") {
      return c.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }


    const result =
      await linearTeamIssuesService.getCacheStats();

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Issues] Get cache stats error:", error);
    return c.json(
      { success: false, error: "Failed to fetch cache stats" },
      { status: 500 },
    );
  }
});