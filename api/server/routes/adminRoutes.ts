/**
 *Admin Routes - Teifi Client Portal
 *
 * User management, customer management, activity logs
 * Schema V2.0 - Unified architecture
 *
 * @module adminRoutes
 */

import { Hono } from "hono";
import * as kv from "../kv_store";
import { supabase, adminMiddleware } from "../authHelpers";
import { UserMethodsV2 } from "../methods/userMethodsV2";
import { customerMethodsV2 } from "../methods/customerMethodsV2";
import { adminHelpers } from "../helpers/adminHelpers";
import { teamMethodsV2 } from "../methods/teamMethodsV2";

export const adminRoutes = new Hono();

// Apply admin middleware to all admin routes only
adminRoutes.use("/admin/*", adminMiddleware);

// ==================================================
// ADMIN DASHBOARD
// ==================================================

/**
 * GET /admin/stats
 * Get admin dashboard statistics
 */
adminRoutes.get("/admin/stats", async (c) => {
  try {
    const user = c.get("user");

    const result = await adminHelpers.getDashboardStats(supabase);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get stats error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch dashboard stats",
      },
      { status: 500 }
    );
  }
});

// ==================================================
// USER MANAGEMENT
// ==================================================

/**
 * GET /admin/users
 * Get all users
 */
adminRoutes.get("/admin/users", async (c) => {
  try {
    const user = c.get("user");

    const result = await UserMethodsV2.getAllUsers(supabase);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get users error:", error);
    return c.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
});

/**
 * POST /admin/users
 * Create new user
 */
adminRoutes.post("/admin/users", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { email, password, name, role, status, customers } = body;

    // Validate required fields
    if (!email || !password) {
      return c.json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const result = await UserMethodsV2.createUser(
      { email, password, name, role, status, customers },
      supabase,
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      message: "User created successfully",
    });
  } catch (error) {
    console.error("[Admin] Create user error:", error);
    return c.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/users/:userId
 * Get single user by ID
 */
adminRoutes.get("/admin/users/:userId", async (c) => {
  try {
    const user = c.get("user");
    const userId = c.req.param("userId");

    const result = await UserMethodsV2.getUserById(userId, supabase);

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        {
          status: result.error?.includes("not found") ? 404 : 500,
        }
      );
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get user error:", error);
    return c.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
});

/**
 * PUT /admin/users/:userId
 * Update user with customer assignments
 *
 * Schema V2.0: Handles customer assignment sync
 */
adminRoutes.put("/admin/users/:userId", async (c) => {
  try {
    const user = c.get("user");
    const userId = c.req.param("userId");
    const body = await c.req.json();
    const { name, role, status, customers } = body;

    // Update basic user info (pass supabase for Auth metadata update)
    const result = await UserMethodsV2.updateUser(
      userId,
      { name, role, status },
      user.id,
      supabase //CRITICAL: Pass supabase to update Auth metadata
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    //SYNC CUSTOMER ASSIGNMENTS (if provided)
    if (Array.isArray(customers)) {
      const syncResult = await UserMethodsV2.syncCustomerAssignments(
        userId,
        customers,
        user.id
      );

      if (!syncResult.success) {
        console.warn(`️ [Admin] Customer sync failed:`, syncResult.error);
      } else {
      }
    }

    return c.json({
      success: true,
      data: result.data,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("[Admin] Update user error:", error);
    return c.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /admin/users/:userId
 * Delete user
 */
adminRoutes.delete("/admin/users/:userId", async (c) => {
  try {
    const user = c.get("user");
    const userId = c.req.param("userId");

    const result = await UserMethodsV2.deleteUser(userId, supabase);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("[Admin] Delete user error:", error);
    return c.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/users/:userId/customers
 * Get user's assigned customers
 */
adminRoutes.get("/admin/users/:userId/customers", async (c) => {
  try {
    const userId = c.req.param("userId");

    const result = await UserMethodsV2.getUserCustomers(userId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Admin] Get user customers error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch user customers",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /admin/users/:userId/customers/:customerId
 * Assign user to customer
 */
adminRoutes.post("/admin/users/:userId/customers/:customerId", async (c) => {
  try {
    const user = c.get("user");
    const userId = c.req.param("userId");
    const customerId = c.req.param("customerId");

    const result = await UserMethodsV2.assignUserToCustomer(
      userId,
      customerId,
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "User assigned to customer successfully",
    });
  } catch (error) {
    console.error("[Admin] Assign user to customer error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to assign user to customer",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /admin/users/:userId/customers/:customerId
 * Remove user from customer
 */
adminRoutes.delete("/admin/users/:userId/customers/:customerId", async (c) => {
  try {
    const user = c.get("user");
    const userId = c.req.param("userId");
    const customerId = c.req.param("customerId");

    const result = await UserMethodsV2.removeUserFromCustomer(
      userId,
      customerId,
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "User removed from customer successfully",
    });
  } catch (error) {
    console.error("[Admin] Remove user from customer error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to remove user from customer",
      },
      { status: 500 }
    );
  }
});

// ==================================================
// CUSTOMER MANAGEMENT
// ==================================================

/**
 * GET /admin/customers
 * Get all customers
 */
adminRoutes.get("/admin/customers", async (c) => {
  try {
    const user = c.get("user");

    const result = await customerMethodsV2.getAllCustomers();

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get customers error:", error);
    return c.json(
      { success: false, error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
});

/**
 * POST /admin/customers
 * Create new customer
 */
adminRoutes.post("/admin/customers", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { name, status, metadata } = body;

    if (!name) {
      return c.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      );
    }

    const result = await customerMethodsV2.createCustomer(
      { name, status, metadata },
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      message: "Customer created successfully",
    });
  } catch (error) {
    console.error("[Admin] Create customer error:", error);
    return c.json(
      { success: false, error: "Failed to create customer" },
      { status: 500 }
    );
  }
});

/**
 * PUT /admin/customers/:customerId
 * Update customer
 */
adminRoutes.put("/admin/customers/:customerId", async (c) => {
  try {
    const user = c.get("user");
    const customerId = c.req.param("customerId");
    const body = await c.req.json();
    const { name, status, metadata } = body;

    const result = await customerMethodsV2.updateCustomer(
      customerId,
      { name, status, metadata },
      user.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("[Admin] Update customer error:", error);
    return c.json(
      { success: false, error: "Failed to update customer" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /admin/customers/:customerId
 * Delete customer
 */
adminRoutes.delete("/admin/customers/:customerId", async (c) => {
  try {
    const user = c.get("user");
    const customerId = c.req.param("customerId");

    const result = await customerMethodsV2.deleteCustomer(customerId, user.id);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("[Admin] Delete customer error:", error);
    return c.json(
      { success: false, error: "Failed to delete customer" },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/customers/:customerId/teams
 * Get teams assigned to a customer
 */
adminRoutes.get("/admin/customers/:customerId/teams", async (c) => {
  try {
    const user = c.get("user");
    const customerId = c.req.param("customerId");

    const result = await customerMethodsV2.getCustomerTeams(customerId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get customer teams error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch customer teams",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /admin/customers/:customerId/teams
 * Assign team to customer
 */
adminRoutes.post("/admin/customers/:customerId/teams", async (c) => {
  try {
    const admin = c.get("user");
    const customerId = c.req.param("customerId");
    const body = await c.req.json();
    const { linearTeamId, linear_team_id } = body;

    // Support both field names for compatibility
    const teamId = linearTeamId || linear_team_id;

    if (!teamId) {
      return c.json(
        { success: false, error: "Team ID is required" },
        { status: 400 }
      );
    }

    const result = await customerMethodsV2.assignTeamToCustomer(
      customerId,
      teamId,
      admin.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Team assigned to customer successfully",
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Assign team to customer error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign team to customer",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /admin/customers/:customerId/teams/:teamId
 * Remove team from customer
 */
adminRoutes.delete("/admin/customers/:customerId/teams/:teamId", async (c) => {
  try {
    const admin = c.get("user");
    const customerId = c.req.param("customerId");
    const teamId = c.req.param("teamId");

    const result = await customerMethodsV2.removeTeamFromCustomer(
      customerId,
      teamId
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "Team removed from customer successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Remove team from customer error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove team from customer",
      },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/customers/:customerId/teams/:teamId/members
 * Get members assigned to a specific team within a customer
 */
adminRoutes.get(
  "/admin/customers/:customerId/teams/:teamId/members",
  async (c) => {
    try {
      const admin = c.get("user");
      const customerId = c.req.param("customerId");
      const teamId = c.req.param("teamId");

      const result = await customerMethodsV2.getCustomerTeamMembers(
        customerId,
        teamId
      );

      if (!result.success) {
        return c.json({ success: false, error: result.error }, { status: 500 });
      }

      return c.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Admin] Get customer team members error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch team members",
        },
        { status: 500 }
      );
    }
  }
);

/**
 * POST /admin/customers/:customerId/teams/:teamId/members
 * Add member to a specific team within a customer
 */
adminRoutes.post(
  "/admin/customers/:customerId/teams/:teamId/members",
  async (c) => {
    try {
      const admin = c.get("user");
      const customerId = c.req.param("customerId");
      const teamId = c.req.param("teamId");
      const body = await c.req.json();
      const { userId } = body;

      if (!userId) {
        return c.json(
          { success: false, error: "User ID is required" },
          { status: 400 }
        );
      }

      const result = await customerMethodsV2.addMemberToCustomerTeam(
        customerId,
        teamId,
        userId,
        admin.id
      );

      if (!result.success) {
        return c.json({ success: false, error: result.error }, { status: 500 });
      }

      return c.json({
        success: true,
        message: "Member added to team successfully",
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Admin] Add member to team error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to add member to team",
        },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /admin/customers/:customerId/teams/:teamId/members/:userId
 * Remove member from a specific team within a customer
 */
adminRoutes.delete(
  "/admin/customers/:customerId/teams/:teamId/members/:userId",
  async (c) => {
    try {
      const admin = c.get("user");
      const customerId = c.req.param("customerId");
      const teamId = c.req.param("teamId");
      const userId = c.req.param("userId");

      const result = await customerMethodsV2.removeMemberFromCustomerTeam(
        customerId,
        teamId,
        userId,
        admin.id
      );

      if (!result.success) {
        return c.json({ success: false, error: result.error }, { status: 500 });
      }

      return c.json({
        success: true,
        message: "Member removed from team successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Admin] Remove member from team error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to remove member from team",
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /admin/customers/:customerId/members
 * Get all users (members) assigned to a customer
 */
adminRoutes.get("/admin/customers/:customerId/members", async (c) => {
  try {
    const user = c.get("user");
    const customerId = c.req.param("customerId");

    // Get all users assigned to this customer
    const memberIds = (await kv.get(`customer:${customerId}:members`)) || [];

    // Fetch user details for each member
    const members = [];
    for (const userId of memberIds) {
      const userData = await kv.get(`user:${userId}`);
      const membershipData = await kv.get(
        `customer:${customerId}:member:${userId}`
      );

      if (userData) {
        // Parse if string
        const user =
          typeof userData === "string" ? JSON.parse(userData) : userData;

        const membership =
          typeof membershipData === "string"
            ? JSON.parse(membershipData)
            : membershipData;

        members.push({
          userId: user.id, //Schema V2.0: camelCase
          email: user.email,
          name: user.metadata?.name || user.email.split("@")[0],
          role: user.role || "viewer",
          status: user.status || "active",
          assignedAt: membership?.assignedAt || user.createdAt, //Schema V2.0: Include membership date
          assignedBy: membership?.assignedBy, //Schema V2.0: Who assigned the user
        });
      }
    }

    return c.json({
      success: true,
      data: {
        members,
        count: members.length,
        customerId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get customer members error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch customer members",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /admin/customers/:customerId/members
 * Add user to customer
 */
adminRoutes.post("/admin/customers/:customerId/members", async (c) => {
  try {
    const admin = c.get("user");
    const customerId = c.req.param("customerId");
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get existing members
    const members = (await kv.get(`customer:${customerId}:members`)) || [];

    // Check if already member
    if (members.includes(userId)) {
      return c.json({
        success: true,
        message: "User already assigned to customer",
        data: { customerId, userId },
      });
    }

    //Use UserMethodsV2.assignUserToCustomer for complete assignment
    // This ensures ALL required KV keys are created:
    // - customer:{customerId}:members
    // - user:{userId}:customers
    // - customer:{customerId}:member:{userId} (membership record)
    const result = await UserMethodsV2.assignUserToCustomer(
      userId,
      customerId,
      admin.id
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      message: "User added to customer successfully",
      data: { customerId, userId },
    });
  } catch (error) {
    console.error("[Admin] Add customer member error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add customer member",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /admin/customers/:customerId/members/:userId
 * Remove user from customer
 */
adminRoutes.delete(
  "/admin/customers/:customerId/members/:userId",
  async (c) => {
    try {
      const admin = c.get("user");
      const customerId = c.req.param("customerId");
      const userId = c.req.param("userId");

      // Remove from customer members
      const members = (await kv.get(`customer:${customerId}:members`)) || [];
      const updatedMembers = members.filter((id: string) => id !== userId);
      await kv.set(`customer:${customerId}:members`, updatedMembers);

      // Remove customer from user's list
      const userCustomers = (await kv.get(`user:${userId}:customers`)) || [];
      const updatedCustomers = userCustomers.filter(
        (id: string) => id !== customerId
      );
      await kv.set(`user:${userId}:customers`, updatedCustomers);

      return c.json({
        success: true,
        message: "User removed from customer successfully",
      });
    } catch (error) {
      console.error("[Admin] Remove customer member error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to remove customer member",
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /admin/teams/:teamId/customer
 * Get current customer assignment for a team (for exclusivity check)
 */
adminRoutes.get("/admin/teams/:teamId/customer", async (c) => {
  try {
    const admin = c.get("user");
    const teamId = c.req.param("teamId");

    const result = await teamMethodsV2.getTeamCustomer(teamId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get team customer error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get team customer",
      },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/customers/:customerId/available-teams
 * Get teams available for assignment to customer (not assigned to other customers)
 * CRITICAL: Enforces team exclusivity
 */
adminRoutes.get("/admin/customers/:customerId/available-teams", async (c) => {
  try {
    const admin = c.get("user");
    const customerId = c.req.param("customerId");

    const result = await teamMethodsV2.getAvailableTeamsForCustomer(customerId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Admin] Get available teams error:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get available teams",
      },
      { status: 500 }
    );
  }
});

/**
 * GET /admin/customers/:customerId/teams/:teamId/members
 * Get members assigned to a specific team within a customer
 */
adminRoutes.get(
  "/admin/customers/:customerId/teams/:teamId/members",
  async (c) => {
    try {
      const admin = c.get("user");
      const customerId = c.req.param("customerId");
      const teamId = c.req.param("teamId");

      const result = await customerMethodsV2.getCustomerTeamMembers(
        customerId,
        teamId
      );

      if (!result.success) {
        return c.json({ success: false, error: result.error }, { status: 500 });
      }

      return c.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Admin] Get customer team members error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch team members",
        },
        { status: 500 }
      );
    }
  }
);

// ==================================================
// ACTIVITY LOGS
// ==================================================

/**
 * GET /admin/activity
 * Get admin activity logs
 */
adminRoutes.get("/admin/activity", async (c) => {
  try {
    const user = c.get("user");
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");

    const result = await adminHelpers.getActivityLogs({
      limit,
      offset,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Admin] Get activity logs error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch activity logs",
      },
      { status: 500 }
    );
  }
});

// ==================================================
// ROLE DEFINITIONS
// ==================================================

/**
 * GET /admin/roles
 * Get role definitions
 */
adminRoutes.get("/admin/roles", async (c) => {
  try {
    const user = c.get("user");

    const result = await adminHelpers.getRoleDefinitions();

    if (!result.success) {
      return c.json({ success: false, error: result.error }, { status: 500 });
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[Admin] Get role definitions error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch role definitions",
      },
      { status: 500 }
    );
  }
});
