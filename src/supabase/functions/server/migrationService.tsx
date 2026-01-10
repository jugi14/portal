import * as kv from "./kv_store.tsx";

/**
 *Database Migration Service
 * 
 * Ensures data consistency across all KV patterns
 */

export class MigrationService {
  
  /**
   * Run full migration from old schema to new schema
   */
  async migrateToV2(): Promise<{ success: boolean; report: any; error?: string }> {
    try {
      console.log('[Migration] Starting v2.0 schema migration...');
      
      const report = {
        users_migrated: 0,
        customer_memberships_created: 0,
        team_assignments_created: 0,
        indexes_created: 0,
        errors: [] as string[]
      };

      // Step 1: Migrate user permissions
      console.log('[Migration] Step 1: Migrating user permissions...');
      const userResult = await this.migrateUserPermissions();
      report.users_migrated = userResult.count;
      report.customer_memberships_created = userResult.memberships;
      if (userResult.errors) report.errors.push(...userResult.errors);

      // Step 2: Build customer indexes
      console.log('[Migration] Step 2: Building customer member indexes...');
      const indexResult = await this.buildCustomerMemberIndexes();
      report.indexes_created = indexResult.count;
      if (indexResult.errors) report.errors.push(...indexResult.errors);

      // Step 3: Create team-customer mappings
      console.log('[Migration] Step 3: Creating team-customer mappings...');
      const teamResult = await this.createTeamCustomerMappings();
      report.team_assignments_created = teamResult.count;
      if (teamResult.errors) report.errors.push(...teamResult.errors);

      console.log('[Migration] Migration completed!');
      console.log('[Migration] Report:', report);

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      return {
        success: false,
        report: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Migrate user_permissions:* pattern
   * OLD: { user_id, customer_id (embedded), role, status }
   * NEW: { user_id, role (global), status } + separate user_customer:* mappings
   */
  private async migrateUserPermissions(): Promise<{ count: number; memberships: number; errors: string[] }> {
    const errors: string[] = [];
    let usersProcessed = 0;
    let membershipsCreated = 0;

    try {
      const userKeys = await kv.getByPrefix('user_permissions:');
      console.log(`[Migration] Found ${userKeys.length} user permission keys`);

      for (const userKey of userKeys) {
        try {
          const user = await kv.get(userKey);
          if (!user) continue;

          const userId = userKey.replace('user_permissions:', '');

          // Check if user has embedded customer_id (old schema)
          if (user.customer_id && user.customer_id !== 'global') {
            console.log(`[Migration] Migrating user ${user.email}: ${user.customer_id}`);

            // Create new user-customer mapping
            const membership = {
              user_id: userId,
              customer_id: user.customer_id,
              role: user.role,
              status: user.status || 'active',
              created_at: user.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              assigned_by: user.created_by || 'system-migration'
            };

            await kv.set(`user_customer:${userId}:${user.customer_id}`, membership);
            membershipsCreated++;

            // Remove embedded customer_id from user record
            const cleanUser = { ...user };
            delete cleanUser.customer_id;
            
            // Keep role only for Teifi employees
            const isTeifiEmployee = user.email?.includes('@teifi.com') || user.email?.includes('@teifi.ca');
            if (!isTeifiEmployee) {
              delete cleanUser.role; // Client users don't have global role
            }

            await kv.set(userKey, cleanUser);

            console.log(`[Migration] Migrated user ${user.email}`);
          }

          usersProcessed++;

        } catch (userError) {
          const errorMsg = `Error migrating user ${userKey}: ${userError}`;
          console.error(`[Migration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`[Migration] Processed ${usersProcessed} users, created ${membershipsCreated} memberships`);

      return { count: usersProcessed, memberships: membershipsCreated, errors };

    } catch (error) {
      console.error('[Migration] User permissions migration failed:', error);
      return { count: usersProcessed, memberships: membershipsCreated, errors: [String(error)] };
    }
  }

  /**
   * Build customer member indexes for fast queries
   * Creates: customer_members:{customerId} = [userId1, userId2, ...]
   */
  private async buildCustomerMemberIndexes(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let indexesCreated = 0;

    try {
      // Get all user-customer mappings
      const membershipKeys = await kv.getByPrefix('user_customer:');
      console.log(`[Migration] Found ${membershipKeys.length} user-customer mappings`);

      // Group by customer
      const customerMembers = new Map<string, string[]>();

      for (const key of membershipKeys) {
        try {
          const membership = await kv.get(key);
          if (!membership || !membership.customer_id) continue;

          const userId = key.split(':')[1];
          const customerId = membership.customer_id;

          if (!customerMembers.has(customerId)) {
            customerMembers.set(customerId, []);
          }

          const members = customerMembers.get(customerId)!;
          if (!members.includes(userId)) {
            members.push(userId);
          }

        } catch (keyError) {
          const errorMsg = `Error processing ${key}: ${keyError}`;
          console.error(`[Migration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Create index keys
      for (const [customerId, userIds] of customerMembers.entries()) {
        try {
          await kv.set(`customer_members:${customerId}`, userIds);
          indexesCreated++;
          console.log(`[Migration] Created index for customer ${customerId}: ${userIds.length} members`);
        } catch (indexError) {
          const errorMsg = `Error creating index for ${customerId}: ${indexError}`;
          console.error(`[Migration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`[Migration] Created ${indexesCreated} customer member indexes`);

      return { count: indexesCreated, errors };

    } catch (error) {
      console.error('[Migration] Index building failed:', error);
      return { count: indexesCreated, errors: [String(error)] };
    }
  }

  /**
   * Create team-customer reverse mappings
   * Creates: team_customer:{teamId} = customerId
   */
  private async createTeamCustomerMappings(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let mappingsCreated = 0;

    try {
      // Get all customers
      const customerKeys = await kv.getByPrefix('customer:');
      console.log(`[Migration] Found ${customerKeys.length} customer keys`);

      for (const customerKey of customerKeys) {
        try {
          // Skip metadata keys
          const customerId = customerKey.replace('customer:', '');
          if (customerId.includes(':')) continue;

          // Get assigned teams
          const assignedTeams = await kv.get(`customer:${customerId}:assigned_teams`);
          if (!Array.isArray(assignedTeams) || assignedTeams.length === 0) continue;

          const customer = await kv.get(customerKey);
          if (!customer) continue;

          console.log(`[Migration] Processing customer ${customer.name}: ${assignedTeams.length} teams`);

          for (const teamId of assignedTeams) {
            try {
              // Create reverse lookup: team -> customer
              await kv.set(`team_customer:${teamId}`, customerId);

              // Create detailed mapping
              const team = await kv.get(`linear_teams:${teamId}`);
              await kv.set(`customer_teams:${customerId}:${teamId}`, {
                customer_id: customerId,
                team_id: teamId,
                team_name: team?.name || 'Unknown Team',
                assigned_at: new Date().toISOString(),
                assigned_by: 'system-migration'
              });

              mappingsCreated++;
              console.log(`[Migration] Mapped team ${teamId} -> customer ${customerId}`);

            } catch (teamError) {
              const errorMsg = `Error mapping team ${teamId}: ${teamError}`;
              console.error(`[Migration] ${errorMsg}`);
              errors.push(errorMsg);
            }
          }

        } catch (customerError) {
          const errorMsg = `Error processing customer ${customerKey}: ${customerError}`;
          console.error(`[Migration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log(`[Migration] Created ${mappingsCreated} team-customer mappings`);

      return { count: mappingsCreated, errors };

    } catch (error) {
      console.error('[Migration] Team mapping creation failed:', error);
      return { count: mappingsCreated, errors: [String(error)] };
    }
  }

  /**
   * Validate schema consistency
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      console.log('[Migration] Validating schema consistency...');

      // Check 1: All user-customer mappings reference valid users
      const membershipKeys = await kv.getByPrefix('user_customer:');
      for (const key of membershipKeys) {
        const userId = key.split(':')[1];
        const user = await kv.get(`user_permissions:${userId}`);
        if (!user) {
          issues.push(`Orphaned membership: ${key} - user not found`);
        }
      }

      // Check 2: All customer member indexes are correct
      const indexKeys = await kv.getByPrefix('customer_members:');
      for (const key of indexKeys) {
        const customerId = key.replace('customer_members:', '');
        const customer = await kv.get(`customer:${customerId}`);
        if (!customer) {
          issues.push(`Orphaned index: ${key} - customer not found`);
        }
      }

      // Check 3: All team-customer mappings reference valid teams and customers
      const teamCustomerKeys = await kv.getByPrefix('team_customer:');
      for (const key of teamCustomerKeys) {
        const teamId = key.replace('team_customer:', '');
        const customerId = await kv.get(key);
        
        const team = await kv.get(`linear_teams:${teamId}`);
        if (!team) {
          issues.push(`Invalid team mapping: ${key} - team not found`);
        }

        const customer = await kv.get(`customer:${customerId}`);
        if (!customer) {
          issues.push(`Invalid team mapping: ${key} - customer not found`);
        }
      }

      const valid = issues.length === 0;
      console.log(valid ? '[Migration] Schema validation passed' : `️ [Migration] Found ${issues.length} issues`);

      return { valid, issues };

    } catch (error) {
      console.error('[Migration] Schema validation failed:', error);
      return { valid: false, issues: [String(error)] };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<any> {
    try {
      // Count old-style user_permissions with embedded customer_id
      const userKeys = await kv.getByPrefix('user_permissions:');
      let oldStyleUsers = 0;
      
      for (const key of userKeys) {
        const user = await kv.get(key);
        if (user?.customer_id && user.customer_id !== 'global') {
          oldStyleUsers++;
        }
      }

      // Count new-style mappings
      const membershipKeys = await kv.getByPrefix('user_customer:');
      const indexKeys = await kv.getByPrefix('customer_members:');
      const teamMappingKeys = await kv.getByPrefix('team_customer:');

      return {
        old_style_users: oldStyleUsers,
        new_style_memberships: membershipKeys.length,
        customer_indexes: indexKeys.length,
        team_mappings: teamMappingKeys.length,
        migration_needed: oldStyleUsers > 0,
        migration_complete: oldStyleUsers === 0 && membershipKeys.length > 0
      };

    } catch (error) {
      console.error('[Migration] Status check failed:', error);
      return { error: String(error) };
    }
  }
}

export const migrationService = new MigrationService();
