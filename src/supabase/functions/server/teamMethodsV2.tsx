/**
 *TEAM MANAGEMENT METHODS - Schema v2.0
 * 
 *Schema v2.0 Patterns:
 * - linear_teams:{linearTeamId} → Linear team object (synced from Linear API)
 * - customer:{customerId}:teams → [linearTeamId1, linearTeamId2, ...]
 * - user:{userId}:customers → [customerId1, customerId2, ...]
 * 
 *ACCESS CONTROL: Customer-Level (Simplified & Optimized)
 * - User → Customer → Teams
 * - If user is member of customer → sees ALL customer's teams
 * - No team-level member filtering required
 * - Team member lists (customer:{customerId}:team:{teamId}:members) optional for future granular control
 * 
 * Key Notes:
 * - Teams are synced from Linear.app API (not created manually)
 * - Customer-Team assignments managed in customerMethodsV2
 * - User access via customer membership (simplified workflow)
 */

import * as kv from "./kv_store.tsx";
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

export class TeamMethodsV2 {
  //PERFORMANCE: KV cache for enriched hierarchy (30 seconds TTL)
  private readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds
  private readonly ENRICHED_CACHE_KEY = 'linear_teams:enriched';
  
  // PERFORMANCE: Cache for team ownership mappings (5 minutes TTL)
  private readonly OWNERSHIP_CACHE_KEY = 'team_ownership_map:all';
  private readonly OWNERSHIP_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get available teams for a customer (teams not assigned to other customers)
   * CRITICAL: Enforces team exclusivity - only returns unassigned teams
   * OPTIMIZED: Batch fetch with aggressive caching for ownership mappings
   */
  async getAvailableTeamsForCustomer(
    customerId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Getting available teams for customer: ${customerId}`);
      const startTime = Date.now();
      
      // Get all teams from cache
      const allTeamsResult = await this.getAllTeams(false);
      if (!allTeamsResult.success || !allTeamsResult.data?.teams) {
        return {
          success: false,
          error: 'Failed to fetch teams from cache'
        };
      }
      
      const allTeams = allTeamsResult.data.teams;
      console.log(`[TeamMethodsV2] Loaded ${allTeams.length} teams from cache`);
      
      // Get teams already assigned to THIS customer
      const customerTeamsIds = await kv.get(`customer:${customerId}:teams`) || [];
      
      // CRITICAL OPTIMIZATION: Check cache for ownership mappings first
      let teamOwnershipMap = new Map<string, string>();
      let usedCache = false;
      
      const cachedOwnership = await kv.get(this.OWNERSHIP_CACHE_KEY);
      
      if (cachedOwnership && typeof cachedOwnership === 'object') {
        const age = Date.now() - (cachedOwnership.timestamp || 0);
        
        if (age < this.OWNERSHIP_CACHE_TTL_MS) {
          console.log(`[TeamMethodsV2] Using cached ownership mappings (age: ${age}ms)`);
          teamOwnershipMap = new Map(cachedOwnership.data || []);
          usedCache = true;
        } else {
          console.log(`[TeamMethodsV2] Ownership cache expired (age: ${age}ms > ${this.OWNERSHIP_CACHE_TTL_MS}ms)`);
          await kv.del(this.OWNERSHIP_CACHE_KEY);
        }
      }
      
      // If cache miss, fetch from database
      if (!usedCache) {
        console.log(`[TeamMethodsV2] Cache miss - fetching ownership mappings from database`);
        
        // PERFORMANCE: Use KV getByPrefix instead of Supabase query to avoid timeout
        // This is much faster than LIKE query on large tables
        try {
          const ownershipKeys = await kv.getByPrefix('team:');
          console.log(`[TeamMethodsV2] Found ${ownershipKeys.length} team-related keys from KV`);
          
          // Filter for ownership keys (team:{teamId}:customer)
          const ownershipRecords = ownershipKeys.filter(key => key.endsWith(':customer'));
          console.log(`[TeamMethodsV2] Filtered to ${ownershipRecords.length} ownership records`);
          
          // Build ownership map: teamId -> customerId
          for (const key of ownershipRecords) {
            // Extract teamId from "team:{teamId}:customer"
            const parts = key.split(':');
            if (parts.length === 3 && parts[0] === 'team' && parts[2] === 'customer') {
              const teamId = parts[1];
              const ownerId = await kv.get(key);
              
              if (ownerId && typeof ownerId === 'string') {
                teamOwnershipMap.set(teamId, ownerId);
              } else {
                console.warn(`[TeamMethodsV2] Invalid ownership record: key=${key}, value=${typeof ownerId}`);
              }
            }
          }
          
          console.log(
            `[TeamMethodsV2] Built ownership map with ${teamOwnershipMap.size} assigned teams from ${ownershipRecords.length} KV records`,
          );
        } catch (kvError) {
          console.error('[TeamMethodsV2] Error fetching from KV store:', kvError);
          // Fallback to empty map if KV fails
          console.log('[TeamMethodsV2] Falling back to showing all teams as available');
        }
        
        // CACHE the ownership mappings for next request
        await kv.set(this.OWNERSHIP_CACHE_KEY, {
          data: Array.from(teamOwnershipMap.entries()),
          timestamp: Date.now()
        });
        
        console.log(`[TeamMethodsV2] Cached ownership mappings for ${this.OWNERSHIP_CACHE_TTL_MS / 1000}s`);
      }
      
      // Debug: Log sample mappings for verification
      if (teamOwnershipMap.size > 0) {
        const sampleEntries = Array.from(teamOwnershipMap.entries()).slice(0, 3);
        console.log(
          `[TeamMethodsV2] Sample ownership mappings:`,
          sampleEntries.map(([teamId, customerId]) => `${teamId} → ${customerId}`).join(', ')
        );
      } else {
        console.log(`[TeamMethodsV2] WARNING: No ownership mappings found - all teams will appear available`);
      }
      
      // CRITICAL DEBUG: Log filtering for this customer
      console.log(
        `[TeamMethodsV2] Filtering teams for customer: ${customerId}`
      );
      
      // Filter teams using O(1) Map lookup instead of N queries
      const availableTeams = [];
      const excludedTeams = [];
      
      for (const team of allTeams) {
        const assignedCustomerId = teamOwnershipMap.get(team.id);
        
        // Include team if:
        // 1. Not assigned to anyone (assignedCustomerId is null/undefined)
        // 2. OR assigned to THIS customer (for re-assignment scenarios)
        if (!assignedCustomerId || assignedCustomerId === customerId) {
          availableTeams.push({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            state: team.state,
            color: team.color,
            isAssignedToThisCustomer: customerTeamsIds.includes(team.id)
          });
        } else {
          excludedTeams.push({
            teamId: team.id,
            teamName: team.name,
            assignedTo: assignedCustomerId
          });
        }
      }
      
      // Debug: Show what teams were excluded and why
      if (excludedTeams.length > 0) {
        console.log(
          `[TeamMethodsV2] Excluded ${excludedTeams.length} teams already assigned to other customers:`,
          excludedTeams.slice(0, 3).map(t => `${t.teamName} → ${t.assignedTo}`).join(', ')
        );
      } else {
        console.log(`[TeamMethodsV2] No teams excluded - all teams are available`);
      }
      
      const duration = Date.now() - startTime;
      console.log(
        `[TeamMethodsV2] Found ${availableTeams.length} available teams (out of ${allTeams.length} total) in ${duration}ms - OPTIMIZED`,
      );
      
      return {
        success: true,
        data: {
          teams: availableTeams,
          count: availableTeams.length,
          totalTeams: allTeams.length
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get available teams error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available teams'
      };
    }
  }
  
  /**
   *Schema v2.0: Get all Linear teams with hierarchy support (synced from Linear API)
   *OPTIMIZED: KV caching + batch queries
   * 
   * Returns teams with parent-child relationships from Linear Team Hierarchy Sync
   */
  async getAllTeams(includeHierarchy = false): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('[TeamMethodsV2] Fetching all Linear teams (includeHierarchy:', includeHierarchy, ')');
      
      // OPTIMIZATION: Check KV cache first (if hierarchy requested)
      if (includeHierarchy) {
        const cachedEnriched = await kv.get(this.ENRICHED_CACHE_KEY);
        
        if (cachedEnriched && typeof cachedEnriched === 'object') {
          const age = Date.now() - (cachedEnriched.timestamp || 0);
          
          if (age < this.CACHE_TTL_MS) {
            console.log(`[TeamMethodsV2] Using enriched KV cache (age: ${age}ms)`);
            return {
              success: true,
              data: {
                ...cachedEnriched.data,
                cached: true,
                cacheAge: age,
                source: 'enriched-cache'
              }
            };
          } else {
            console.log(`[TeamMethodsV2] Enriched cache expired (age: ${age}ms > ${this.CACHE_TTL_MS}ms)`);
            await kv.del(this.ENRICHED_CACHE_KEY);
          }
        }
      }
      
      // Try to get cached hierarchy from KV (if requested)
      if (includeHierarchy) {
        console.log('[TeamMethodsV2] Checking KV for cached hierarchy...');
        let cachedHierarchy = await kv.get('linear_teams:all');
        
        // CRITICAL FIX: Parse JSON string if needed (sync stores JSON.stringify)
        if (typeof cachedHierarchy === 'string') {
          console.log('[TeamMethodsV2] Parsing JSON string from KV...');
          try {
            cachedHierarchy = JSON.parse(cachedHierarchy);
          } catch (err) {
            console.error('[TeamMethodsV2] Failed to parse cached hierarchy:', err);
            cachedHierarchy = null;
          }
        }
        
        console.log('[TeamMethodsV2] Cache check:', {
          exists: !!cachedHierarchy,
          type: typeof cachedHierarchy,
          hasTeams: !!cachedHierarchy?.teams,
          teamsCount: cachedHierarchy?.teams?.length || 0,
          hasHierarchy: !!cachedHierarchy?.hierarchy,
          hierarchyCount: cachedHierarchy?.hierarchy?.length || 0
        });
        
        // FIX: Use cache if it has teams OR hierarchy (not just hierarchy)
        if (cachedHierarchy && (cachedHierarchy.teams || cachedHierarchy.hierarchy)) {
          console.log('[TeamMethodsV2] Using KV cached team data');
          
          // Enrich hierarchy with internal data (members, customers) if available
          const enrichedHierarchy = cachedHierarchy.hierarchy 
            ? await this.enrichTeamHierarchy(cachedHierarchy.hierarchy)
            : [];
          
          const responseData = {
            teams: cachedHierarchy.teams || [],
            hierarchy: enrichedHierarchy,
            rootTeamsCount: cachedHierarchy.rootTeamsCount || 0,
            totalTeamsCount: cachedHierarchy.totalTeamsCount || 0,
            count: cachedHierarchy.count || cachedHierarchy.teams?.length || 0,
            syncedAt: cachedHierarchy.syncedAt,
            source: 'kv-cache'
          };
          
          // Store enriched data in KV cache for future requests (30s TTL)
          await kv.set(this.ENRICHED_CACHE_KEY, {
            data: responseData,
            timestamp: Date.now()
          });
          
          console.log(`[TeamMethodsV2] Cached enriched hierarchy for 30s`);
          
          return {
            success: true,
            data: responseData
          };
        }
        
        console.warn('[TeamMethodsV2] No cached hierarchy found, falling back to individual fetch');
      }
      
      // OPTIMIZED FALLBACK: Batch fetch teams without N+1 queries
      console.log('[TeamMethodsV2] Fallback to individual team fetching (optimized)...');
      const startTime = Date.now();
      
      const teamKeys = await kv.getByPrefix('linear_teams:');
      console.log(`[TeamMethodsV2] Found ${teamKeys.length} team keys`);
      
      const teams = [];
      const processedIds = new Set();
      const teamIds: string[] = [];
      
      // Phase 1: Parse all teams (no extra queries)
      for (const key of teamKeys) {
        try {
          // Skip the cached hierarchy key
          if (key === 'linear_teams:all') {
            continue;
          }
          
          const teamId = key.replace('linear_teams:', '');
          
          // Skip duplicates
          if (processedIds.has(teamId)) {
            continue;
          }
          processedIds.add(teamId);
          teamIds.push(teamId);
          
          let team = await kv.get(key);
          
          // Parse JSON string if needed
          if (typeof team === 'string') {
            try {
              team = JSON.parse(team);
            } catch (err) {
              console.warn(`️ [TeamMethodsV2] Failed to parse team at ${key}:`, err);
              continue;
            }
          }
          
          if (!team || !team.id) {
            console.warn(`️ [TeamMethodsV2] Invalid team at ${key}`);
            continue;
          }
          
          teams.push({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description || '',
            state: team.state || 'active',
            color: team.color,
            icon: team.icon,
            timezone: team.timezone,
            cyclesEnabled: team.cyclesEnabled,
            issueCount: team.issueCount || 0,
            parentId: team.parentId || team.parent_id || null,
            parentName: team.parentName || team.parent_name || null,
            parentKey: team.parentKey || team.parent_key || null,
            createdAt: team.createdAt || team.created_at,
            updatedAt: team.updatedAt || team.updated_at,
            // Placeholders - will be filled in Phase 2
            membersCount: 0,
            customersCount: 0
          });
        } catch (error) {
          console.warn(`️ [TeamMethodsV2] Error processing team ${key}:`, error);
        }
      }
      
      // Phase 2: Batch fetch members and customer counts
      console.log(`[TeamMethodsV2] Batch fetching metadata for ${teams.length} teams...`);
      
      // Build team members map
      const teamMembersPromises = teams.map(async (team) => {
        const memberIds = await kv.get(`team:${team.id}:members`) || [];
        return { teamId: team.id, count: memberIds.length };
      });
      const teamMembersResults = await Promise.all(teamMembersPromises);
      const teamMembersMap = new Map(
        teamMembersResults.map(r => [r.teamId, r.count])
      );
      
      // Build team->customer count map
      const customerKeys = await kv.getByPrefix('customer:');
      const customerIds = customerKeys
        .filter(key => !key.includes(':'))
        .map(key => key.replace('customer:', ''));
      
      const customerTeamsPromises = customerIds.map(async (customerId) => {
        const teams = await kv.get(`customer:${customerId}:teams`) || [];
        return teams;
      });
      const customerTeamsResults = await Promise.all(customerTeamsPromises);
      
      const teamCustomerCountMap = new Map<string, number>();
      for (const customerTeams of customerTeamsResults) {
        for (const teamId of customerTeams) {
          teamCustomerCountMap.set(
            teamId,
            (teamCustomerCountMap.get(teamId) || 0) + 1
          );
        }
      }
      
      // Phase 3: Apply counts to teams
      for (const team of teams) {
        team.membersCount = teamMembersMap.get(team.id) || 0;
        team.customersCount = teamCustomerCountMap.get(team.id) || 0;
      }
      
      const duration = Date.now() - startTime;
      console.log(`[TeamMethodsV2] Processed ${teams.length} teams in ${duration}ms (optimized)`);
      
      return {
        success: true,
        data: {
          teams,
          count: teams.length,
          source: 'flat-optimized'
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get all teams error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams'
      };
    }
  }
  
  /**
   *Enrich team hierarchy with internal data (members, customers)
   *OPTIMIZED: Pre-fetch all data once, build lookup maps - O(1) access
   * Private helper method
   */
  private async enrichTeamHierarchy(hierarchy: any[]): Promise<any[]> {
    if (!hierarchy || hierarchy.length === 0) {
      return [];
    }
    
    console.log(`[TeamMethodsV2] Enriching ${hierarchy.length} team nodes (optimized)...`);
    const startTime = Date.now();
    
    //OPTIMIZATION 1: Pre-fetch all team members data ONCE
    const allTeamIds = this.extractAllTeamIds(hierarchy);
    console.log(`[TeamMethodsV2] Found ${allTeamIds.size} unique teams to enrich`);
    
    const teamMembersMap = new Map<string, number>();
    
    // Batch fetch all team members
    const memberPromises = Array.from(allTeamIds).map(async (teamId) => {
      const memberIds = await kv.get(`team:${teamId}:members`) || [];
      teamMembersMap.set(teamId, memberIds.length);
    });
    await Promise.all(memberPromises);
    
    //OPTIMIZATION 2: Pre-fetch all customers and their teams ONCE
    const customerKeys = await kv.getByPrefix('customer:');
    const customerIds = customerKeys
      .filter(key => !key.includes(':'))  // Only root customer keys
      .map(key => key.replace('customer:', ''));
    
    console.log(`[TeamMethodsV2] Found ${customerIds.length} customers to check`);
    
    // Build customer->teams lookup map
    const customerTeamsMap = new Map<string, string[]>();
    const customerTeamPromises = customerIds.map(async (customerId) => {
      const teams = await kv.get(`customer:${customerId}:teams`) || [];
      customerTeamsMap.set(customerId, teams);
    });
    await Promise.all(customerTeamPromises);
    
    //OPTIMIZATION 3: Build reverse lookup - team -> customer count
    const teamCustomerCountMap = new Map<string, number>();
    for (const [customerId, teams] of customerTeamsMap.entries()) {
      for (const teamId of teams) {
        teamCustomerCountMap.set(
          teamId,
          (teamCustomerCountMap.get(teamId) || 0) + 1
        );
      }
    }
    
    //OPTIMIZATION 4: Recursively enrich using pre-built maps (O(1) lookup)
    const enrichNode = (node: any): any => {
      const teamId = node.id;
      
      // O(1) lookups instead of N queries
      const membersCount = teamMembersMap.get(teamId) || 0;
      const customersCount = teamCustomerCountMap.get(teamId) || 0;
      
      // Recursively enrich children
      const enrichedChildren = node.children && node.children.length > 0
        ? node.children.map(enrichNode)
        : [];
      
      return {
        ...node,
        membersCount,    //Schema V2.0: camelCase
        customersCount,  //Schema V2.0: camelCase
        children: enrichedChildren
      };
    };
    
    const enriched = hierarchy.map(enrichNode);
    
    const duration = Date.now() - startTime;
    console.log(`[TeamMethodsV2] Enrichment complete in ${duration}ms (${allTeamIds.size} teams, ${customerIds.length} customers)`);
    
    return enriched;
  }
  
  /**
   *Extract all team IDs from hierarchy tree (recursive)
   * Helper for batch enrichment
   */
  private extractAllTeamIds(hierarchy: any[]): Set<string> {
    const teamIds = new Set<string>();
    
    const traverse = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.id) {
          teamIds.add(node.id);
        }
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(hierarchy);
    return teamIds;
  }
  
  /**
   *Invalidate enriched hierarchy cache
   * Call this after Linear sync or team modifications
   */
  async invalidateCache(): Promise<void> {
    console.log('️ [TeamMethodsV2] Invalidating enriched hierarchy cache');
    await kv.del(this.ENRICHED_CACHE_KEY);
  }
  
  /**
   *Get cache stats (for debugging)
   */
  async getCacheStats(): Promise<{ cached: boolean; age?: number; ttl: number }> {
    const cachedEnriched = await kv.get(this.ENRICHED_CACHE_KEY);
    
    if (!cachedEnriched || typeof cachedEnriched !== 'object') {
      return { cached: false, ttl: this.CACHE_TTL_MS };
    }
    
    const age = Date.now() - (cachedEnriched.timestamp || 0);
    return {
      cached: true,
      age,
      ttl: this.CACHE_TTL_MS
    };
  }
  
  /**
   *Schema v2.0: Get team by ID with full details + hierarchy info
   * 
   * Returns team with parent/children relationships from Linear Team Hierarchy
   */
  async getTeamById(teamId: string, includeHierarchy = true): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Fetching team: ${teamId} (hierarchy: ${includeHierarchy})`);
      
      let team = await kv.get(`linear_teams:${teamId}`);
      
      //Parse JSON string if needed
      if (typeof team === 'string') {
        try {
          team = JSON.parse(team);
        } catch (err) {
          console.error(`[TeamMethodsV2] Failed to parse team ${teamId}:`, err);
          return {
            success: false,
            error: 'Failed to parse team data'
          };
        }
      }
      
      if (!team) {
        return {
          success: false,
          error: 'Team not found'
        };
      }
      
      // Get team members with access
      const memberIds = await kv.get(`team:${teamId}:members`) || [];
      const members = [];
      
      for (const userId of memberIds) {
        let userObj = await kv.get(`user:${userId}`);
        let membership = await kv.get(`team:${teamId}:member:${userId}`);
        
        //Parse JSON string if needed
        if (typeof userObj === 'string') {
          try {
            userObj = JSON.parse(userObj);
          } catch (err) {
            console.warn(`️ [TeamMethodsV2] Failed to parse user ${userId}:`, err);
            continue;
          }
        }
        
        if (typeof membership === 'string') {
          try {
            membership = JSON.parse(membership);
          } catch (err) {
            console.warn(`️ [TeamMethodsV2] Failed to parse membership:`, err);
            membership = null;
          }
        }
        
        if (userObj) {
          members.push({
            user_id: userId,
            email: userObj.email,
            name: userObj.metadata?.name || userObj.email.split('@')[0],
            role: userObj.role,
            status: userObj.status,
            assigned_at: membership?.assigned_at,
            assigned_by: membership?.assigned_by
          });
        }
      }
      
      // Get customers assigned to this team
      const customerKeys = await kv.getByPrefix('customer:');
      const assignedCustomers = [];
      
      for (const customerKey of customerKeys) {
        if (customerKey.includes(':')) {
          continue;
        }
        const customerId = customerKey.replace('customer:', '');
        const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
        
        if (customerTeams.includes(teamId)) {
          let customer = await kv.get(`customer:${customerId}`);
          
          //Parse JSON string if needed
          if (typeof customer === 'string') {
            try {
              customer = JSON.parse(customer);
            } catch (err) {
              console.warn(`️ [TeamMethodsV2] Failed to parse customer ${customerId}:`, err);
              continue;
            }
          }
          
          if (customer) {
            assignedCustomers.push({
              id: customer.id,
              name: customer.name,
              status: customer.status
            });
          }
        }
      }
      
      //Get hierarchy information (parent and children)
      let parentTeam = null;
      let childTeams = [];
      
      if (includeHierarchy) {
        // Get parent team if exists
        const teamParentId = team.parentId || team.parent_id; //Schema V2.0: Support both
        if (teamParentId) {
          let parent = await kv.get(`linear_teams:${teamParentId}`);
          
          //Parse JSON string if needed
          if (typeof parent === 'string') {
            try {
              parent = JSON.parse(parent);
            } catch (err) {
              console.warn(`️ [TeamMethodsV2] Failed to parse parent team:`, err);
              parent = null;
            }
          }
          
          if (parent) {
            parentTeam = {
              id: parent.id,
              name: parent.name,
              key: parent.key,
              description: parent.description,
              color: parent.color,
              icon: parent.icon
            };
          }
        }
        
        // Get child teams (teams where this team is parent)
        let allTeamsData = await kv.get('linear_teams:all');
        
        //Parse JSON string if needed
        if (typeof allTeamsData === 'string') {
          try {
            allTeamsData = JSON.parse(allTeamsData);
          } catch (err) {
            console.warn(`️ [TeamMethodsV2] Failed to parse all teams data:`, err);
            allTeamsData = null;
          }
        }
        
        if (allTeamsData?.teams) {
          childTeams = allTeamsData.teams
            .filter((t: any) => (t.parentId || t.parent_id) === teamId) //Schema V2.0: Support both
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              key: t.key,
              description: t.description,
              color: t.color,
              icon: t.icon
            }));
        }
      }
      
      return {
        success: true,
        data: {
          team: {
            ...team,
            //NEW: Hierarchy information
            parent: parentTeam,
            children: childTeams,
            childCount: childTeams.length,
            hasParent: !!(team.parentId || team.parent_id), //Schema V2.0: Support both
            hasChildren: childTeams.length > 0,
            // Existing fields
            members,
            membersCount: members.length, //Schema V2.0: camelCase
            customers: assignedCustomers,
            customersCount: assignedCustomers.length //Schema V2.0: camelCase
          }
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team'
      };
    }
  }
  
  /**
   *Schema v2.0: Get team members (users with access to this team)
   */
  async getTeamMembers(teamId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Getting members for team: ${teamId}`);
      
      const team = await kv.get(`linear_teams:${teamId}`);
      if (!team) {
        return {
          success: false,
          error: 'Team not found'
        };
      }
      
      const memberIds = await kv.get(`team:${teamId}:members`) || [];
      const members = [];
      
      for (const userId of memberIds) {
        const userObj = await kv.get(`user:${userId}`);
        const membership = await kv.get(`team:${teamId}:member:${userId}`);
        
        if (userObj) {
          members.push({
            userId: userId, //Schema V2.0: camelCase
            email: userObj.email,
            name: userObj.metadata?.name || userObj.email.split('@')[0],
            role: userObj.role,
            status: userObj.status,
            assignedAt: membership?.assignedAt || membership?.assigned_at, //Schema V2.0: camelCase with backward compat
            assignedBy: membership?.assignedBy || membership?.assigned_by //Schema V2.0: camelCase with backward compat
          });
        }
      }
      
      console.log(`[TeamMethodsV2] Found ${members.length} members with team access`);
      
      return {
        success: true,
        data: {
          members,
          count: members.length
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get team members error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team members'
      };
    }
  }
  
  /**
   *Schema v2.0: Assign user to team (grant team access)
   */
  async assignUserToTeam(
    userId: string,
    teamId: string,
    assignedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Assigning user ${userId} to team ${teamId}`);
      
      // Verify user exists
      const userObj = await kv.get(`user:${userId}`);
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Verify team exists
      const team = await kv.get(`linear_teams:${teamId}`);
      if (!team) {
        return {
          success: false,
          error: 'Team not found'
        };
      }
      
      //Add team to user's teams list
      const userTeams = await kv.get(`user:${userId}:teams`) || [];
      if (!userTeams.includes(teamId)) {
        userTeams.push(teamId);
        await kv.set(`user:${userId}:teams`, userTeams);
      }
      
      //Add user to team's members list
      const teamMembers = await kv.get(`team:${teamId}:members`) || [];
      if (!teamMembers.includes(userId)) {
        teamMembers.push(userId);
        await kv.set(`team:${teamId}:members`, teamMembers);
      }
      
      //Create detailed membership record
      const membership = {
        userId: userId, //Schema V2.0: camelCase
        teamId: teamId, //Schema V2.0: camelCase
        assignedAt: new Date().toISOString(), //Schema V2.0: camelCase
        assignedBy: assignedBy //Schema V2.0: camelCase
      };
      await kv.set(`team:${teamId}:member:${userId}`, membership);
      
      console.log(`[TeamMethodsV2] User assigned to team successfully`);
      
      return {
        success: true,
        data: {
          message: 'User assigned to team successfully',
          membership: membership
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Assign user to team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign user to team'
      };
    }
  }
  
  /**
   *Schema v2.0: Remove user from team (revoke team access)
   */
  async removeUserFromTeam(
    userId: string,
    teamId: string,
    removedBy: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Removing user ${userId} from team ${teamId}`);
      
      //Remove team from user's teams list
      const userTeams = await kv.get(`user:${userId}:teams`) || [];
      const updatedUserTeams = userTeams.filter((id: string) => id !== teamId);
      await kv.set(`user:${userId}:teams`, updatedUserTeams);
      
      //Remove user from team's members list
      const teamMembers = await kv.get(`team:${teamId}:members`) || [];
      const updatedTeamMembers = teamMembers.filter((id: string) => id !== userId);
      await kv.set(`team:${teamId}:members`, updatedTeamMembers);
      
      //Delete detailed membership record
      await kv.del(`team:${teamId}:member:${userId}`);
      
      console.log(`[TeamMethodsV2] User removed from team successfully`);
      
      return {
        success: true,
        data: {
          message: 'User removed from team successfully'
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Remove user from team error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove user from team'
      };
    }
  }
  
  /**
   *Schema v2.0: Get teams for a specific customer
   */
  async getTeamsByCustomer(customerId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Getting teams for customer: ${customerId}`);
      
      const customer = await kv.get(`customer:${customerId}`);
      if (!customer) {
        return {
          success: false,
          error: 'Customer not found'
        };
      }
      
      const teamIds = await kv.get(`customer:${customerId}:teams`) || [];
      const teams = [];
      
      for (const teamId of teamIds) {
        const team = await kv.get(`linear_teams:${teamId}`);
        if (team) {
          teams.push({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            state: team.state,
            color: team.color,
            issueCount: team.issueCount || 0
          });
        }
      }
      
      console.log(`[TeamMethodsV2] Found ${teams.length} teams for customer`);
      
      return {
        success: true,
        data: {
          teams,
          count: teams.length
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get teams by customer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams for customer'
      };
    }
  }
  
  /**
   *Schema v2.0: Check if user has access to team
   * (either through direct assignment or customer membership)
   */
  async checkUserTeamAccess(
    userId: string,
    teamId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Checking team access for user ${userId} on team ${teamId}`);
      
      // Get user object to check role
      const userObj = await kv.get(`user:${userId}`);
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Superadmin and admin have access to all teams
      if (userObj.role === 'superadmin' || userObj.role === 'admin') {
        return {
          success: true,
          data: {
            hasAccess: true,
            reason: 'admin_role'
          }
        };
      }
      
      //OPTIMIZED: Customer-level access (simplified check)
      const userCustomers = await kv.get(`user:${userId}:customers`) || [];
      
      for (const customerId of userCustomers) {
        // Check if team is assigned to this customer
        const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
        
        if (customerTeams.includes(teamId)) {
          //User has access via customer membership (no team-level check)
          return {
            success: true,
            data: {
              hasAccess: true,
              reason: 'customer_member_access',
              customerId: customerId
            }
          };
        }
      }
      
      // No access found
      return {
        success: true,
        data: {
          hasAccess: false,
          reason: 'no_access'
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Check user team access error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check team access'
      };
    }
  }
  
  /**
   *Schema v2.0: Get all teams accessible by user
   * (includes admin access, direct assignments, and customer-based access)
   */
  async getUserAccessibleTeams(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Getting accessible teams for user: ${userId}`);
      
      const userObj = await kv.get(`user:${userId}`);
      if (!userObj) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Superadmin and admin have access to all teams
      if (userObj.role === 'superadmin' || userObj.role === 'admin') {
        const allTeamsResult = await this.getAllTeams();
        if (allTeamsResult.success) {
          return {
            success: true,
            data: {
              teams: allTeamsResult.data.teams,
              count: allTeamsResult.data.count,
              access_reason: 'admin_role'
            }
          };
        }
      }
      
      const accessibleTeamIds = new Set<string>();
      
      //OPTIMIZED: Customer-level access (no team-level check)
      const userCustomers = await kv.get(`user:${userId}:customers`) || [];
      
      for (const customerId of userCustomers) {
        // Get all teams assigned to this customer
        const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
        
        //User sees ALL customer teams (simplified access)
        for (const teamId of customerTeams) {
          accessibleTeamIds.add(teamId);
        }
      }
      
      // Load team details
      const teams = [];
      for (const teamId of Array.from(accessibleTeamIds)) {
        const team = await kv.get(`linear_teams:${teamId}`);
        if (team) {
          teams.push({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            state: team.state,
            color: team.color,
            issueCount: team.issueCount || 0
          });
        }
      }
      
      console.log(`[TeamMethodsV2] Found ${teams.length} accessible teams for user`);
      
      return {
        success: true,
        data: {
          teams,
          count: teams.length
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get user accessible teams error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch accessible teams'
      };
    }
  }
  
  /**
   *Schema v2.0: Get team hierarchy for user (Customer > Teams structure)
   * Returns teams grouped by customers with parent-child relationships
   */
  async getTeamHierarchy(
    userId: string,
    isSuperAdmin: boolean
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      console.log(`️ [TeamMethodsV2] Getting team hierarchy for user: ${userId}, superadmin: ${isSuperAdmin}`);
      
      let accessibleTeamIds: string[] = [];
      
      // 1. Get accessible teams based on role
      if (isSuperAdmin) {
        // Superadmin sees ALL teams
        console.log('[TeamMethodsV2] Superadmin - fetching all teams');
        const teamKeys = await kv.getByPrefix('linear_teams:');
        accessibleTeamIds = teamKeys
          .filter((key: string) => !key.includes(':all')) // Skip cache key
          .map((key: string) => key.replace('linear_teams:', ''));
      } else {
        //OPTIMIZED: Customer-level access - User sees ALL customer's teams
        console.log(`[TeamMethodsV2] Loading teams for regular user...`);
        
        // Get user's customers
        const userCustomers = await kv.get(`user:${userId}:customers`) || [];
        console.log(`[TeamMethodsV2] User belongs to ${userCustomers.length} customers`);
        
        const accessibleSet = new Set<string>();
        
        //SIMPLIFIED: Customer-level access
        // If user is member of customer → sees ALL customer's teams
        for (const customerId of userCustomers) {
          // Get all teams assigned to this customer
          const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
          console.log(`[TeamMethodsV2] Customer ${customerId} has ${customerTeams.length} teams`);
          
          //Add ALL customer teams (no team-level check)
          for (const teamId of customerTeams) {
            accessibleSet.add(teamId);
            console.log(`[TeamMethodsV2] User has access to team ${teamId} via customer ${customerId}`);
          }
        }
        
        accessibleTeamIds = Array.from(accessibleSet);
        console.log(`[TeamMethodsV2] User has ${accessibleTeamIds.length} accessible teams (via customer membership)`);
      }
      
      if (accessibleTeamIds.length === 0) {
        console.log('️ [TeamMethodsV2] No accessible teams found');
        return {
          success: true,
          data: []
        };
      }
      
      // 2. Fetch team details and group by customer
      const customerMap = new Map<string, any>();
      
      for (const teamId of accessibleTeamIds) {
        let team = await kv.get(`linear_teams:${teamId}`);
        
        //Parse JSON string if needed
        if (typeof team === 'string') {
          try {
            team = JSON.parse(team);
          } catch (err) {
            console.warn(`️ [TeamMethodsV2] Failed to parse team ${teamId}:`, err);
            continue;
          }
        }
        
        if (!team) {
          console.warn(`️ [TeamMethodsV2] Team ${teamId} not found in cache`);
          continue;
        }
        
        // Find which customer(s) this team belongs to
        const customerKeys = await kv.getByPrefix('customer:');
        
        for (const customerKey of customerKeys) {
          //FIX: Only skip nested keys (those with ADDITIONAL colons after "customer:ID")
          // customer:abc123VALID (customer object)
          // customer:abc123:teamsSKIP (nested key)
          const customerIdPart = customerKey.replace('customer:', '');
          if (customerIdPart.includes(':')) continue; // Skip nested keys like :teams, :members, etc
          
          const customerId = customerIdPart;
          const customerTeams = await kv.get(`customer:${customerId}:teams`) || [];
          
          if (customerTeams.includes(teamId)) {
            // Get or create customer entry
            if (!customerMap.has(customerId)) {
              let customer = await kv.get(`customer:${customerId}`);
              
              //Parse JSON string if needed
              if (typeof customer === 'string') {
                try {
                  customer = JSON.parse(customer);
                } catch (err) {
                  console.warn(`️ [TeamMethodsV2] Failed to parse customer ${customerId}:`, err);
                  continue;
                }
              }
              if (customer) {
                customerMap.set(customerId, {
                  id: customerId,
                  name: customer.name,
                  key: customer.name.substring(0, 3).toUpperCase(),
                  children: []
                });
              }
            }
            
            // Add team to customer's children
            const customerEntry = customerMap.get(customerId);
            if (customerEntry) {
              customerEntry.children.push({
                id: team.id,
                name: team.name,
                key: team.key,
                description: team.description || '',
                level: 1,
                children: [] // Teams don't have children in current schema
              });
            }
          }
        }
      }
      
      // 3. Convert map to array
      const hierarchy = Array.from(customerMap.values());
      
      console.log(`[TeamMethodsV2] Built hierarchy: ${hierarchy.length} customers, ${accessibleTeamIds.length} teams`);
      
      return {
        success: true,
        data: hierarchy
      };
      
    } catch (error) {
      console.error('[TeamMethodsV2] Get team hierarchy error:', error);
      console.error('[TeamMethodsV2] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        userId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch team hierarchy'
      };
    }
  }
  
  /**
   * Get team's current customer assignment
   * CRITICAL: Used to check team ownership exclusivity
   */
  async getTeamCustomer(
    teamId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`[TeamMethodsV2] Getting customer for team: ${teamId}`);
      
      // Get team-to-customer mapping
      const customerId = await kv.get(`team:${teamId}:customer`);
      
      if (!customerId) {
        return {
          success: true,
          data: {
            teamId,
            customerId: null,
            customerName: null,
            isAssigned: false
          }
        };
      }
      
      // Get customer details
      const customer = await kv.get(`customer:${customerId}`);
      
      return {
        success: true,
        data: {
          teamId,
          customerId,
          customerName: customer?.name || 'Unknown Customer',
          isAssigned: true
        }
      };
    } catch (error) {
      console.error('[TeamMethodsV2] Get team customer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get team customer'
      };
    }
  }
}

// Export singleton instance
export const teamMethodsV2 = new TeamMethodsV2();