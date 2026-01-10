import * as kv from "./kv_store.tsx";

/**
 *CUSTOMER MANAGEMENT METHODS - Schema v2.0
 *
 * Schema v2.0 Patterns:
 * - customer:{customerId} → Primary customer object
 * - customer:{customerId}:members → [userId1, userId2, ...]
 * - customer:{customerId}:member:{userId} → Detailed membership
 * - customer:{customerId}:teams → [linearTeamId1, linearTeamId2, ...]
 * - user:{userId}:customers → [customerId1, customerId2, ...]
 *
 * Key Changes from v1.0:
 * - Simplified customer structure
 * - User memberships stored in both directions (customer->users, user->customers)
 * - No more organization terminology
 * - Team assignments are simple lists
 */

export class CustomerMethodsV2 {
  /**
   *Schema v2.0: Get all customers with stats
   */
  async getAllCustomers(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      console.log(
        "[CustomerMethodsV2] Fetching all customers...",
      );

      // Get all customer keys
      const customerKeys = await kv.getByPrefix("customer:");
      console.log(
        `[CustomerMethodsV2] Found ${customerKeys.length} customer keys`,
      );

      const customers = [];
      const processedIds = new Set();

      for (const key of customerKeys) {
        try {
          const customerId = key.replace("customer:", "");

          // Skip metadata keys (e.g., customer:{id}:members, customer:{id}:teams)
          if (customerId.includes(":")) {
            continue;
          }

          // Skip duplicates
          if (processedIds.has(customerId)) {
            continue;
          }
          processedIds.add(customerId);

          const customer = await kv.get(key);

          if (!customer || !customer.id) {
            console.warn(
              `️ [CustomerMethodsV2] Invalid customer at ${key}`,
            );
            continue;
          }

          //Get members count
          const memberIds =
            (await kv.get(`customer:${customerId}:members`)) ||
            [];

          //Get teams count
          const teamIds =
            (await kv.get(`customer:${customerId}:teams`)) ||
            [];

          customers.push({
            id: customer.id,
            name: customer.name,
            description: customer.description || "",
            contactEmail:
              customer.contactEmail || customer.contact_email,
            google_domain: customer.google_domain,
            project: customer.project,
            epic: customer.epic,
            environment: customer.environment || "UAT",
            status: customer.status || "active",
            createdAt:
              customer.createdAt ||
              customer.created_at ||
              new Date().toISOString(), //Schema V2.0: camelCase
            updatedAt:
              customer.updatedAt ||
              customer.updated_at ||
              new Date().toISOString(), //Schema V2.0: camelCase
            usersCount: memberIds.length, //Schema V2.0: camelCase
            teamsCount: teamIds.length, //Schema V2.0: camelCase
          });
        } catch (error) {
          console.warn(
            `️ [CustomerMethodsV2] Error processing customer ${key}:`,
            error,
          );
        }
      }

      console.log(
        `[CustomerMethodsV2] Processed ${customers.length} customers`,
      );

      return {
        success: true,
        data: {
          customers,
          count: customers.length,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Get all customers error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch customers",
      };
    }
  }

  /**
   *Schema v2.0: Get customer by ID with full details
   */
  async getCustomerById(
    customerId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Fetching customer: ${customerId}`,
      );

      const customer = await kv.get(`customer:${customerId}`);

      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      // Get members
      const memberIds =
        (await kv.get(`customer:${customerId}:members`)) || [];
      const members = [];
      for (const userId of memberIds) {
        const membership = await kv.get(
          `customer:${customerId}:member:${userId}`,
        );
        const userObj = await kv.get(`user:${userId}`);
        if (userObj && membership) {
          members.push({
            userId: userId, //Schema V2.0: camelCase
            email: userObj.email,
            name:
              userObj.metadata?.name ||
              userObj.email.split("@")[0],
            role: userObj.role,
            status: userObj.status,
            assignedAt:
              membership.assignedAt || membership.assigned_at, //Schema V2.0: camelCase with backward compat
            assignedBy:
              membership.assignedBy || membership.assigned_by, //Schema V2.0: camelCase with backward compat
          });
        }
      }

      // Get teams
      const teamIds =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      const teams = [];
      for (const teamId of teamIds) {
        const team = await kv.get(`linear_teams:${teamId}`);
        if (team) {
          teams.push({
            id: teamId,
            name: team.name,
            key: team.key,
            description: team.description,
          });
        }
      }

      return {
        success: true,
        data: {
          customer: {
            ...customer,
            members,
            teams,
            usersCount: members.length, //Schema V2.0: camelCase
            teamsCount: teams.length, //Schema V2.0: camelCase
          },
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Get customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch customer",
      };
    }
  }

  /**
   *Schema v2.0: Create new customer
   */
  async createCustomer(
    customerData: {
      name: string;
      description?: string;
      contactEmail?: string;
      google_domain?: string;
      project?: string;
      epic?: string;
      environment?: string;
      status?: string;
    },
    createdBy: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Creating customer: ${customerData.name}`,
      );

      if (!customerData.name || !customerData.name.trim()) {
        return {
          success: false,
          error: "Customer name is required",
        };
      }

      // Generate customer ID
      const customerId = crypto.randomUUID();

      const customer = {
        id: customerId,
        name: customerData.name.trim(),
        description: customerData.description?.trim() || "",
        contactEmail: customerData.contactEmail?.trim() || null,
        google_domain:
          customerData.google_domain?.trim() || null,
        project: customerData.project?.trim() || null,
        epic: customerData.epic?.trim() || null,
        environment: customerData.environment || "UAT",
        status: customerData.status || "active",
        createdAt: new Date().toISOString(), //Schema V2.0: camelCase
        updatedAt: new Date().toISOString(), //Schema V2.0: camelCase
        createdBy: createdBy, //Schema V2.0: camelCase
      };

      //Save customer object
      await kv.set(`customer:${customerId}`, customer);

      //Initialize empty members and teams lists
      await kv.set(`customer:${customerId}:members`, []);
      await kv.set(`customer:${customerId}:teams`, []);

      console.log(
        `[CustomerMethodsV2] Customer created: ${customerId}`,
      );

      return {
        success: true,
        data: {
          customer: {
            ...customer,
            usersCount: 0, //Schema V2.0: camelCase
            teamsCount: 0, //Schema V2.0: camelCase
          },
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Create customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create customer",
      };
    }
  }

  /**
   *Schema v2.0: Update customer
   */
  async updateCustomer(
    customerId: string,
    updates: {
      name?: string;
      description?: string;
      contactEmail?: string;
      google_domain?: string;
      project?: string;
      epic?: string;
      environment?: string;
      status?: string;
    },
    updatedBy: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Updating customer: ${customerId}`,
      );

      const customer = await kv.get(`customer:${customerId}`);

      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      const updatedCustomer = {
        ...customer,
        ...Object.fromEntries(
          Object.entries(updates).filter(
            ([_, v]) => v !== undefined,
          ),
        ),
        updatedAt: new Date().toISOString(), //Schema V2.0: camelCase
        updatedBy: updatedBy, //Schema V2.0: camelCase
      };

      await kv.set(`customer:${customerId}`, updatedCustomer);

      console.log(
        `[CustomerMethodsV2] Customer updated: ${customerId}`,
      );

      return {
        success: true,
        data: {
          customer: updatedCustomer,
          message: "Customer updated successfully",
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Update customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update customer",
      };
    }
  }

  /**
   *Schema v2.0: Delete customer and cleanup all relationships
   */
  async deleteCustomer(
    customerId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Deleting customer: ${customerId}`,
      );

      //Get all members
      const memberIds =
        (await kv.get(`customer:${customerId}:members`)) || [];

      //Remove customer from all users' customer lists
      for (const userId of memberIds) {
        const userCustomers =
          (await kv.get(`user:${userId}:customers`)) || [];
        const updatedUserCustomers = userCustomers.filter(
          (id: string) => id !== customerId,
        );
        await kv.set(
          `user:${userId}:customers`,
          updatedUserCustomers,
        );

        // Delete membership detail
        await kv.del(`customer:${customerId}:member:${userId}`);
        console.log(` Removed from user: ${userId}`);
      }

      //Delete customer object and metadata
      await kv.del(`customer:${customerId}`);
      await kv.del(`customer:${customerId}:members`);
      await kv.del(`customer:${customerId}:teams`);

      console.log(
        `[CustomerMethodsV2] Customer deleted: ${customerId}`,
      );

      return {
        success: true,
        data: {
          message: "Customer deleted successfully",
          removedMembers: memberIds.length, //Schema V2.0: camelCase
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Delete customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete customer",
      };
    }
  }

  /**
   *Schema v2.0: Get customer members
   */
  async getCustomerMembers(
    customerId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Getting members for customer: ${customerId}`,
      );

      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      const memberIds =
        (await kv.get(`customer:${customerId}:members`)) || [];
      const members = [];

      for (const userId of memberIds) {
        const userObj = await kv.get(`user:${userId}`);
        const membership = await kv.get(
          `customer:${customerId}:member:${userId}`,
        );

        if (userObj) {
          members.push({
            userId: userId, //Schema V2.0: camelCase
            email: userObj.email,
            name:
              userObj.metadata?.name ||
              userObj.email.split("@")[0],
            role: userObj.role,
            status: userObj.status,
            assignedAt:
              membership?.assignedAt || userObj.createdAt, //Schema V2.0: camelCase
            assignedBy: membership?.assignedBy, //Schema V2.0: camelCase
          });
        }
      }

      console.log(
        `[CustomerMethodsV2] Found ${members.length} members`,
      );

      return {
        success: true,
        data: {
          members,
          count: members.length,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Get customer members error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch customer members",
      };
    }
  }

  /**
   *Schema v2.0: Get customer teams with mapping from Linear cache
   */
  async getCustomerTeams(
    customerId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Getting teams for customer: ${customerId}`,
      );

      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      // Get team IDs assigned to this customer
      const teamIds =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      console.log(
        `[CustomerMethodsV2] Customer team IDs:`,
        teamIds,
      );

      //Load ALL teams from Linear cache hierarchy
      const linearCache = await kv.get("linear_teams:all");
      console.log(
        `[CustomerMethodsV2] Linear cache loaded:`,
        linearCache ? "YES" : "NO",
      );

      const teams = [];

      if (
        linearCache &&
        linearCache.teams &&
        Array.isArray(linearCache.teams)
      ) {
        console.log(
          `[CustomerMethodsV2] Found ${linearCache.teams.length} teams in Linear cache`,
        );

        // Create a map of all teams by ID for quick lookup
        const teamMap = new Map();
        const flattenTeams = (teamList: any[]) => {
          for (const team of teamList) {
            teamMap.set(team.id, team);
            if (team.children && team.children.length > 0) {
              flattenTeams(team.children);
            }
          }
        };
        flattenTeams(linearCache.teams);

        console.log(
          `[CustomerMethodsV2] Built team map with ${teamMap.size} entries`,
        );

        // Map customer team IDs to full team details
        for (const teamId of teamIds) {
          const team = teamMap.get(teamId);

          if (team) {
            console.log(
              `[CustomerMethodsV2] Mapped team ${teamId}: ${team.name} (${team.key})`,
            );
            teams.push({
              id: team.id,
              name: team.name,
              key: team.key,
              description:
                team.description || `${team.name} team`,
              state: "active",
              color: team.color,
              icon: team.icon,
              parentId: team.parent?.id, //Schema V2.0: camelCase
              parentName: team.parent?.name, //Schema V2.0: camelCase
              parentKey: team.parent?.key, //Schema V2.0: camelCase
            });
          } else {
            // Team not found in Linear cache - use fallback
            console.warn(
              `️ [CustomerMethodsV2] Team ${teamId} not found in Linear cache - using fallback`,
            );
            teams.push({
              id: teamId,
              name: `Team ${teamId.substring(0, 8)}`,
              key: teamId.substring(0, 8),
              description:
                "Team not synced from Linear. Please sync teams.",
              state: "unknown",
            });
          }
        }
      } else {
        // No Linear cache available - use fallback for all teams
        console.warn(
          `️ [CustomerMethodsV2] No Linear cache found - using fallback names`,
        );
        for (const teamId of teamIds) {
          teams.push({
            id: teamId,
            name: `Team ${teamId.substring(0, 8)}`,
            key: teamId.substring(0, 8),
            description:
              "Linear cache not available. Please sync teams in Admin → Teams → Linear Sync.",
            state: "unknown",
          });
        }
      }

      console.log(
        `[CustomerMethodsV2] Returning ${teams.length} teams:`,
        teams.map((t) => ({
          id: t.id,
          name: t.name,
          key: t.key,
        })),
      );

      return {
        success: true,
        data: {
          teams,
          count: teams.length,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Get customer teams error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch customer teams",
      };
    }
  }

  /**
   *Schema v2.0: Assign team to customer
   *
   *FIX: Validates team existence with 3-tier fallback:
   * 1. Try individual team cache (linear_teams:${teamId})
   * 2. Try hierarchical cache (linear_teams:all)
   * 3. Fallback to Linear API (if not in cache)
   */
  async assignTeamToCustomer(
    customerId: string,
    linearTeamId: string,
    assignedBy: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Assigning team ${linearTeamId} to customer ${customerId}`,
      );

      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      //VALIDATION: Check if team exists (3-tier fallback)
      let teamExists = false;
      let teamName = linearTeamId; // Default fallback

      // 1️⃣ Try individual team cache first
      let team = await kv.get(`linear_teams:${linearTeamId}`);

      // Parse if string
      if (typeof team === "string") {
        try {
          team = JSON.parse(team);
        } catch (err) {
          console.warn(
            `️ [CustomerMethodsV2] Failed to parse team ${linearTeamId} from cache`,
          );
          team = null;
        }
      }

      if (team?.id === linearTeamId) {
        teamExists = true;
        teamName = team.name || linearTeamId;
        console.log(
          `[CustomerMethodsV2] Team found in individual cache: ${teamName}`,
        );
      } else {
        // 2️⃣ Try hierarchical cache
        const linearCache = await kv.get("linear_teams:all");

        if (
          linearCache &&
          linearCache.teams &&
          Array.isArray(linearCache.teams)
        ) {
          // Flatten hierarchy to find team
          const findTeam = (teamList: any[]): any => {
            for (const t of teamList) {
              if (t.id === linearTeamId) {
                return t;
              }
              if (t.children && t.children.length > 0) {
                const found = findTeam(t.children);
                if (found) return found;
              }
            }
            return null;
          };

          const foundTeam = findTeam(linearCache.teams);
          if (foundTeam) {
            teamExists = true;
            teamName = foundTeam.name || linearTeamId;
            console.log(
              `[CustomerMethodsV2] Team found in hierarchy cache: ${teamName}`,
            );

            //Cache the team individually for future requests
            await kv.set(
              `linear_teams:${linearTeamId}`,
              foundTeam,
            );
          }
        }

        // 3️⃣ ULTIMATE FALLBACK: Try Linear API
        if (!teamExists) {
          try {
            console.log(
              `[CustomerMethodsV2] Team not in cache, fetching from Linear API...`,
            );
            const { LinearTeamService } = await import(
              "./linearTeamService.tsx"
            );
            const linearService = new LinearTeamService();
            const teamData =
              await linearService.getTeamById(linearTeamId);

            if (teamData?.id === linearTeamId) {
              teamExists = true;
              teamName = teamData.name || linearTeamId;
              console.log(
                `[CustomerMethodsV2] Team found via Linear API: ${teamName}`,
              );

              //Cache the team for future requests
              await kv.set(
                `linear_teams:${linearTeamId}`,
                teamData,
              );
            }
          } catch (err) {
            console.error(
              `[CustomerMethodsV2] Failed to fetch team from Linear API:`,
              err,
            );
          }
        }
      }

      //VALIDATION: Reject if team not found in any source
      if (!teamExists) {
        console.warn(
          `[CustomerMethodsV2] Team ${linearTeamId} not found in any source (cache or API)`,
        );
        return {
          success: false,
          error:
            "Team not found. Please sync Linear teams in Admin > Teams > Linear Sync.",
        };
      }

      // CRITICAL: Check if team is already assigned to another customer
      const existingCustomer = await kv.get(`team:${linearTeamId}:customer`);
      if (existingCustomer && existingCustomer !== customerId) {
        const existingCustomerData = await kv.get(`customer:${existingCustomer}`);
        const existingCustomerName = existingCustomerData?.name || 'Unknown Customer';
        
        console.warn(
          `[CustomerMethodsV2] Team ${teamName} (${linearTeamId}) is already assigned to customer ${existingCustomerName}`,
        );
        return {
          success: false,
          error: `Team "${teamName}" is already assigned to customer "${existingCustomerName}". A team can only belong to one customer at a time. Please unassign it from the other customer first.`,
        };
      }

      //Add team to customer's team list (idempotent)
      const customerTeams =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      if (!customerTeams.includes(linearTeamId)) {
        customerTeams.push(linearTeamId);
        
        console.log(
          `[CustomerMethodsV2] Writing team assignment to KV store:`,
          {
            customerTeamsKey: `customer:${customerId}:teams`,
            teamOwnershipKey: `team:${linearTeamId}:customer`,
            customerId,
            linearTeamId,
            teamName
          }
        );
        
        // Write customer's team list
        const setResult1 = await kv.set(
          `customer:${customerId}:teams`,
          customerTeams,
        );
        console.log(
          `[CustomerMethodsV2] Customer teams list write result:`,
          setResult1 !== undefined ? 'SUCCESS' : 'FAILED'
        );
        
        // CRITICAL: Store team-to-customer mapping for exclusivity check
        const setResult2 = await kv.set(
          `team:${linearTeamId}:customer`,
          customerId,
        );
        console.log(
          `[CustomerMethodsV2] Team ownership mapping write result:`,
          setResult2 !== undefined ? 'SUCCESS' : 'FAILED'
        );
        
        // VERIFY: Read back immediately to confirm write
        const verifyCustomerTeams = await kv.get(`customer:${customerId}:teams`);
        const verifyOwnership = await kv.get(`team:${linearTeamId}:customer`);
        
        console.log(
          `[CustomerMethodsV2] VERIFICATION - Data written successfully:`,
          {
            customerTeamsVerified: Array.isArray(verifyCustomerTeams) && verifyCustomerTeams.includes(linearTeamId),
            ownershipVerified: verifyOwnership === customerId,
            verifyCustomerTeams,
            verifyOwnership
          }
        );
        
        // CRITICAL: If verification failed, throw error
        if (!verifyOwnership || verifyOwnership !== customerId) {
          throw new Error(
            `CRITICAL: Team ownership mapping write FAILED - Expected "${customerId}", got "${verifyOwnership}"`
          );
        }
        
        console.log(
          `[CustomerMethodsV2] Team ${teamName} (${linearTeamId}) assigned to customer - VERIFIED`,
        );
      } else {
        console.log(
          `[CustomerMethodsV2] Team ${teamName} (${linearTeamId}) already assigned to customer`,
        );
      }

      // CRITICAL: Invalidate ownership cache after assignment
      await kv.del('team_ownership_map:all');
      console.log('[CustomerMethodsV2] Invalidated team ownership cache');

      return {
        success: true,
        data: {
          message: `Team "${teamName}" assigned successfully`,
          teamId: linearTeamId,
          teamName,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Assign team to customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to assign team to customer",
      };
    }
  }

  /**
   *Schema v2.0: Remove team from customer
   *FIX: Now includes team member cleanup to prevent orphaned access
   */
  async removeTeamFromCustomer(
    customerId: string,
    linearTeamId: string,
    removedBy?: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Removing team ${linearTeamId} from customer ${customerId}`,
      );

      //CRITICAL: Clean up team members FIRST to prevent orphaned access
      const teamMembersKey = `customer:${customerId}:team:${linearTeamId}:members`;
      const teamMembers = (await kv.get(teamMembersKey)) || [];

      if (teamMembers.length > 0) {
        console.log(
          ` Cleaning up ${teamMembers.length} team member assignments`,
        );
        await kv.del(teamMembersKey);
      }

      // Remove team from customer's team list
      const customerTeams =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      const updatedTeams = customerTeams.filter(
        (id: string) => id !== linearTeamId,
      );
      
      console.log(
        `[CustomerMethodsV2] Removing team ownership from KV store:`,
        {
          customerTeamsKey: `customer:${customerId}:teams`,
          teamOwnershipKey: `team:${linearTeamId}:customer`,
          customerId,
          linearTeamId
        }
      );
      
      await kv.set(
        `customer:${customerId}:teams`,
        updatedTeams,
      );

      // Remove team-to-customer mapping
      const delResult = await kv.del(`team:${linearTeamId}:customer`);
      console.log(
        `[CustomerMethodsV2] Team ownership deletion result:`,
        delResult !== undefined ? 'SUCCESS' : 'FAILED'
      );
      
      // VERIFY: Read back to confirm deletion
      const verifyOwnership = await kv.get(`team:${linearTeamId}:customer`);
      
      console.log(
        `[CustomerMethodsV2] VERIFICATION - Ownership deleted:`,
        {
          ownershipDeleted: verifyOwnership === null || verifyOwnership === undefined,
          verifyOwnership
        }
      );
      
      console.log(
        `[CustomerMethodsV2] Team removed from customer (cleaned ${teamMembers.length} member assignments) - VERIFIED`,
      );

      // CRITICAL: Invalidate ownership cache after removal
      await kv.del('team_ownership_map:all');
      console.log('[CustomerMethodsV2] Invalidated team ownership cache');

      return {
        success: true,
        data: {
          message: "Team removed from customer successfully",
          cleanedMembers: teamMembers.length,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Remove team from customer error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove team from customer",
      };
    }
  }

  /**
   *Schema v2.0: Get team members for a customer's team
   */
  async getCustomerTeamMembers(
    customerId: string,
    teamId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Getting team members for customer ${customerId}, team ${teamId}`,
      );

      // Get team-level member assignments
      const teamMembers =
        (await kv.get(
          `customer:${customerId}:team:${teamId}:members`,
        )) || [];

      // Get user details for each member
      const members = [];
      for (const userId of teamMembers) {
        const user = await kv.get(`user:${userId}`);
        if (user) {
          members.push({
            userId: userId, //Schema V2.0: camelCase
            email: user.email,
            name:
              user.metadata?.name || user.email.split("@")[0],
            role: user.role || "viewer",
          });
        }
      }

      console.log(
        `[CustomerMethodsV2] Loaded ${members.length} team members`,
      );

      return {
        success: true,
        data: {
          members,
          count: members.length,
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Get customer team members error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get team members",
      };
    }
  }

  /**
   *Schema v2.0: Add member to customer's team
   */
  async addMemberToCustomerTeam(
    customerId: string,
    teamId: string,
    userId: string,
    addedBy: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Adding user ${userId} to customer ${customerId}, team ${teamId}`,
      );

      // Verify customer exists
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: "Customer not found",
        };
      }

      // Verify team is assigned to customer
      const customerTeams =
        (await kv.get(`customer:${customerId}:teams`)) || [];
      if (!customerTeams.includes(teamId)) {
        return {
          success: false,
          error: "Team not assigned to customer",
        };
      }

      // Verify user is member of customer
      const customerMembers =
        (await kv.get(`customer:${customerId}:members`)) || [];
      if (!customerMembers.includes(userId)) {
        return {
          success: false,
          error:
            "User not a member of this customer. Please add user to customer first.",
        };
      }

      //ADDITIONAL CHECK: Verify membership record exists (detect data inconsistency)
      const membershipRecord = await kv.get(
        `customer:${customerId}:member:${userId}`,
      );
      if (!membershipRecord) {
        console.warn(
          `️ [CustomerMethodsV2] Data inconsistency: User ${userId} in members list but no membership record`,
        );
        return {
          success: false,
          error:
            "User membership record missing. Please re-assign user to customer to fix.",
        };
      }

      // Add to team members
      const teamMembers =
        (await kv.get(
          `customer:${customerId}:team:${teamId}:members`,
        )) || [];
      if (!teamMembers.includes(userId)) {
        teamMembers.push(userId);
        await kv.set(
          `customer:${customerId}:team:${teamId}:members`,
          teamMembers,
        );
      }

      console.log(`[CustomerMethodsV2] User added to team`);

      return {
        success: true,
        data: {
          message: "User added to team successfully",
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Add member to team error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add member to team",
      };
    }
  }

  /**
   *Schema v2.0: Remove member from customer's team
   */
  async removeMemberFromCustomerTeam(
    customerId: string,
    teamId: string,
    userId: string,
    removedBy: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(
        `[CustomerMethodsV2] Removing user ${userId} from customer ${customerId}, team ${teamId}`,
      );

      // Remove from team members
      const teamMembers =
        (await kv.get(
          `customer:${customerId}:team:${teamId}:members`,
        )) || [];
      const updatedMembers = teamMembers.filter(
        (id: string) => id !== userId,
      );
      await kv.set(
        `customer:${customerId}:team:${teamId}:members`,
        updatedMembers,
      );

      console.log(`[CustomerMethodsV2] User removed from team`);

      return {
        success: true,
        data: {
          message: "User removed from team successfully",
        },
      };
    } catch (error) {
      console.error(
        "[CustomerMethodsV2] Remove member from team error:",
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove member from team",
      };
    }
  }
}

export const customerMethodsV2 = new CustomerMethodsV2();