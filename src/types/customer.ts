/**
 * Customer Types - Simplified Type Definitions
 *
 * Structure: User > Customer > Team
 * Only Admin/Superadmin can manage customers
 */

/**
 * Main Customer interface
 * Represents a client company in the system
 */
export interface Customer {
  id: string;
  name: string;
  description?: string;

  // Contact information
  contactEmail?: string;
  google_domain?: string;

  // Configuration
  project?: string;
  epic?: string;
  environment?: string;

  // Status
  status: "active" | "inactive" | "staging" | "production";

  // Timestamps -Schema V2.0: camelCase
  createdAt: string;
  updatedAt?: string;
  created_at?: string; // Backward compatibility
  updated_at?: string; // Backward compatibility

  // Relations -Schema V2.0: camelCase
  customerTeams?: Array<{
    id: string;
    linearTeamId: string; //Schema V2.0: camelCase
    linearTeamName: string; //Schema V2.0: camelCase
    createdAt?: string; //Schema V2.0: camelCase
    // Backward compatibility
    linear_team_id?: string;
    linear_team_name?: string;
    created_at?: string;
  }>;
  customer_teams?: Array<any>; // Backward compatibility

  userPermissions?: Array<{
    id: string;
    userId: string; //Schema V2.0: camelCase
    role: string;
    createdAt: string; //Schema V2.0: camelCase
    // Backward compatibility
    user_id?: string;
    created_at?: string;
  }>;
  user_permissions?: Array<any>; // Backward compatibility

  // Statistics -Schema V2.0: camelCase
  teamsCount?: number;
  usersCount?: number;
  teams_count?: number; // Backward compatibility
  users_count?: number; // Backward compatibility
}

/**
 * Customer creation input
 */
export interface CustomerCreateInput {
  name: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  project?: string;
  epic?: string;
  environment?: string;
  status?: "active" | "inactive" | "staging" | "production";
}

/**
 * Customer update input
 */
export interface CustomerUpdateInput {
  name?: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  project?: string;
  epic?: string;
  environment?: string;
  status?: "active" | "inactive" | "staging" | "production";
}

/**
 * Customer with enhanced details
 * Used in admin panels with full team and user information
 */
export interface CustomerDetails extends Customer {
  teams: Array<{
    id: string;
    name: string;
    linearTeamId: string; //Schema V2.0: camelCase
    linearTeamName: string; //Schema V2.0: camelCase
    description?: string;
    createdAt: string; //Schema V2.0: camelCase
    // Backward compatibility
    linear_team_id?: string;
    linear_team_name?: string;
    created_at?: string;
  }>;

  members: Array<{
    id: string;
    userId: string; //Schema V2.0: camelCase
    email: string;
    role: string;
    status: string;
    createdAt: string; //Schema V2.0: camelCase
    // Backward compatibility
    user_id?: string;
    created_at?: string;
  }>;
}

/**
 * User-Customer relationship
 */
export interface UserCustomer {
  customer: Customer;
  role: string;
  teams: Array<{
    id: string;
    linearTeamId: string; //Schema V2.0: camelCase
    linearTeamName: string; //Schema V2.0: camelCase
    linearTeamKey: string; //Schema V2.0: camelCase
    customerId: string;
    customerName: string;
    // Backward compatibility
    linear_team_id?: string;
    linear_team_name?: string;
    linear_team_key?: string;
  }>;
  teamCount: number;
}