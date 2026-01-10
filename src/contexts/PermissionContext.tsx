import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Permission,
  Role,
  UserRole,
  ROLE_DEFINITIONS,
  PermissionCheckOptions,
} from "../types/permissions";
import { useAuth } from "./AuthContext";
import { projectId } from "../utils/supabase/info";
import { toast } from "sonner@2.0.3";
import { sessionManager } from "../services/sessionManager";
import { apiClient } from "../services/apiClient";
import { globalCache } from "../services/cacheService";

// Enhanced permission checking with superadmin support
const checkUserPermission = (
  userRole: UserRole | null,
  permission: Permission | Permission[],
  options?: PermissionCheckOptions,
  superadminList?: string[],
): boolean => {
  if (!userRole) return false;

  // Superadmin has all permissions
  if (userRole.role === "superadmin") {
    return true;
  }

  // Double-check using dynamic superadmin list
  if (
    userRole.email &&
    superadminList?.includes(
      userRole.email.toLowerCase().trim(),
    )
  ) {
    return true;
  }

  const permissionsToCheck = Array.isArray(permission)
    ? permission
    : [permission];
  const userPermissions = userRole.permissions || [];

  if (options?.requireAll) {
    return permissionsToCheck.every((p) =>
      userPermissions.includes(p),
    );
  } else {
    return permissionsToCheck.some((p) =>
      userPermissions.includes(p),
    );
  }
};

interface PermissionContextType {
  userRole: UserRole | null;
  loading: boolean;
  teamsLoading: boolean; // NEW: Separate loading state for team hierarchy
  hasPermission: (
    permission: Permission | Permission[],
    options?: PermissionCheckOptions,
  ) => boolean;
  hasRole: (role: Role | Role[]) => boolean;
  hasOrganizationAccess: (organizationId: string) => boolean;
  hasTeamAccess: (teamId: string) => boolean;
  accessibleTeams: string[];
  teamHierarchy: any[]; //NEW: Share hierarchy data
  permissionModel:
    | "customer-level"
    | "team-level"
    | "mixed"
    | null;
  refreshTeamAccess: () => Promise<void>;
  assignRole: (
    email: string,
    role: Role,
    customerId?: string,
    projects?: string[],
  ) => Promise<void>;
  updateUserRole: (
    roleData: Partial<UserRole>,
  ) => Promise<void>;
  getAllUserRoles: () => Promise<UserRole[]>;
  revokeAccess: (email: string) => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<
  PermissionContextType | undefined
>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({
  children,
}: PermissionProviderProps) {
  const [userRole, setUserRole] = useState<UserRole | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(true); // NEW: Separate loading state for team hierarchy
  const { user, session } = useAuth();

  // REFACTORED: Dynamic superadmin list from KV store
  const [superadminEmails, setSuperadminEmails] = useState<
    string[]
  >([]);
  const superadminEmailsRef = useRef<string[]>([]);
  const superadminListFetchedRef = useRef(false); // Track if list has been fetched

  // Team Access State
  const [accessibleTeams, setAccessibleTeams] = useState<
    string[]
  >([]);
  const [permissionModel, setPermissionModel] = useState<
    "customer-level" | "team-level" | "mixed" | null
  >(null);
  const [teamHierarchyState, setTeamHierarchyState] = useState<
    any[]
  >([]); // Internal state

  // OPTIMIZATION: Memoize teamHierarchy to prevent Sidebar re-renders
  const teamHierarchy = useMemo(
    () => teamHierarchyState,
    [teamHierarchyState],
  );

  // Track if permissions were already loaded to prevent re-checks on tab switch
  const permissionsLoadedRef = useRef(false);
  const teamAccessLoadedRef = useRef(false);
  const superadminListLoadingRef = useRef(false); // Prevent duplicate superadmin list calls

  /**
   * REFACTORED: Fetch superadmin list from KV store via API
   * Uses caching to prevent excessive API calls
   * SECURITY: Only call if user is authenticated
   *
   * NOTE: Endpoint returns empty array for non-superadmins (not 403)
   * This prevents circular dependency in permission checking
   */
  const fetchSuperadminList = useCallback(async () => {
    // CRITICAL: Don't call if user not logged in
    if (!user?.email || !session?.access_token) {
      console.log(
        "[PermissionContext] Skipping superadmin list fetch - no auth",
      );
      return;
    }

    // DEDUPLICATION: Prevent multiple simultaneous calls
    if (superadminListLoadingRef.current) {
      console.log(
        "[PermissionContext] Superadmin list already loading - skipping",
      );
      return;
    }

    // PERFORMANCE: Check cache first (1 minute client-side cache)
    const cacheKey = "superadmin:list:client";
    const cached = globalCache.get<string[]>(cacheKey);
    if (cached) {
      console.log(
        "[PermissionContext] Using cached superadmin list",
      );
      setSuperadminEmails(cached);
      superadminEmailsRef.current = cached;
      return;
    }

    try {
      superadminListLoadingRef.current = true;
      // SECURITY: Do not log superadmin operations

      const response = await apiClient.get<{
        superadmins: string[];
        count: number;
        isSuperAdmin?: boolean;
      }>("/superadmin/list");

      if (response.success && response.data) {
        // Update list (will be empty array for non-superadmins)
        const superadmins = response.data.superadmins || [];
        setSuperadminEmails(superadmins);
        superadminEmailsRef.current = superadmins;

        // FIXED: Cache for 1 minute with correct parameter order
        // Signature: set<T>(key, data, ttlMs?, options?)
        globalCache.set(cacheKey, superadmins, 60 * 1000);

        // SECURITY: Do not log superadmin data
      } else {
        // SECURITY: Do not log superadmin failures
      }
    } catch (error) {
      console.error(
        "[PermissionContext] Error fetching superadmin list:",
        error,
      );
      // Keep existing list on error
    } finally {
      superadminListLoadingRef.current = false;
    }
  }, [user?.email, session?.access_token]);

  /**
   * Helper: Check if user is superadmin using fetched list
   */
  const isSuperAdminUser = useCallback(
    (email: string): boolean => {
      return superadminEmailsRef.current.includes(
        email.toLowerCase().trim(),
      );
    },
    [],
  );

  /**
   * Helper: Get default role based on email domain and superadmin list
   */
  const getDefaultRole = useCallback(
    (email: string): Role => {
      const emailLower = email.toLowerCase().trim();

      // Check if user is in superadmin list
      if (isSuperAdminUser(emailLower)) {
        return "superadmin";
      }

      // Teifi employees get admin by default
      if (
        emailLower.includes("@teifi.com") ||
        emailLower.includes("@teifi.ca")
      ) {
        return "admin";
      }

      // Everyone else gets viewer by default
      return "viewer";
    },
    [isSuperAdminUser],
  );

  // Memoized permission loading to prevent unnecessary API calls
  const loadUserPermissions = useCallback(async () => {
    // CRITICAL: Validate auth state BEFORE making API calls
    if (!user?.email) {
      setLoading(false);
      setUserRole(null);

      //CRITICAL: Redirect to login if on protected route
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/auth/callback"
      ) {
        window.location.href = "/login";
      }
      return;
    }

    if (!session?.access_token) {
      setLoading(false);
      setUserRole(null);

      //CRITICAL: Redirect to login if no token
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/auth/callback"
      ) {
        toast.error("Session expired. Please login again.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      }
      return;
    }

    // Validate token is not empty or undefined
    if (
      session.access_token === "undefined" ||
      session.access_token.length < 10
    ) {
      console.error("[PermissionContext] Invalid access token");
      setLoading(false);
      setUserRole(null);

      // CRITICAL: Redirect to login if invalid token
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/auth/callback"
      ) {
        toast.error("Invalid session. Please login again.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
      }
      return;
    }

    // NO CACHE - Always fetch fresh permissions from server
    // This ensures role/permission changes are immediately reflected

    try {
      setLoading(true);

      // CRITICAL: Ensure token is set in apiClient
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.post('/auth/user-login', {});

      if (result.success && result.data?.user) {
        const serverUser = result.data.user;
        const serverPermission = result.data.permission;
        const serverPermissions = result.data.permissions || [];

        // Build user role from V2.0 response
        const emailLower = user.email.toLowerCase().trim();
        const isSuperAdmin = isSuperAdminUser(emailLower);

        // Superadmin and admin users have global access (no specific customer)
        const hasGlobalAccess =
          serverUser.role === "superadmin" ||
          serverUser.role === "admin" ||
          isSuperAdmin;

        const userRole: UserRole = {
          id: serverUser.id,
          email: serverUser.email,
          role: serverUser.role as Role,
          permissions: serverPermissions,
          customerId: hasGlobalAccess
            ? "global"
            : serverPermission?.customer_id || undefined,
          customerName: hasGlobalAccess
            ? "Global Access"
            : undefined,
          projects: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: serverUser.status === "active",
          status: serverUser.status || "active",
          isPending: serverUser.status === "pending",
        };

        setUserRole(userRole);

        // NO CACHE - Permissions should always be fresh
        // sessionManager.cacheData('permissions', userRole, false);
        // sessionManager.markInitialized('permissions');
        permissionsLoadedRef.current = true;
        
        // PERFORMANCE: Set loading=false immediately after permissions loaded
        // This allows UI to render without waiting for team access
        setLoading(false);

        // Show appropriate message based on status
        if (serverUser.status === "pending") {
          toast.info(
            "Your account is pending approval. Access may be limited.",
          );
        }
      } else {
        // Check if error is authentication failure
        if (
          result.error &&
          result.error.includes("Auth session missing")
        ) {
          console.error(
            "[PermissionContext] Authentication failed - session invalid:",
            result.error,
          );

          // Clear auth state and force re-login
          setUserRole(null);
          setLoading(false);

          toast.error("Session expired. Please login again.", {
            duration: 5000,
            action: {
              label: "Login",
              onClick: () => (window.location.href = "/login"),
            },
          });

          return;
        }

        console.error(
          "Failed to load user permissions from server:",
          result,
        );

        // Enhanced fallback with default role assignment
        const emailLower = user.email.toLowerCase().trim();
        const isSuperAdmin = isSuperAdminUser(emailLower);
        const isTeifi =
          emailLower.includes("@teifi.com") ||
          emailLower.includes("@teifi.ca");
        const defaultRole = getDefaultRole(emailLower);

        const userRole: UserRole = {
          id: user.id,
          email: user.email,
          role: defaultRole,
          permissions:
            ROLE_DEFINITIONS[defaultRole]?.permissions || [],
          customerId:
            isSuperAdmin || isTeifi
              ? "global"
              : "CUST-2024-002",
          customerName:
            isSuperAdmin || isTeifi
              ? "Global Access"
              : "Guillevin",
          projects:
            isSuperAdmin || isTeifi
              ? ["Admin Dashboard"]
              : ["Electrical Distribution Platform"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          status: "active",
        };

        setUserRole(userRole);
        
        // PERFORMANCE: Set loading=false on fallback
        setLoading(false);

        if (isSuperAdmin) {
          toast.success(
            "Superadmin access granted (fallback mode)",
          );
        } else if (isTeifi) {
          toast.success("Admin access granted (fallback mode)");
        }
      }
    } catch (error) {
      console.error(
        "[PermissionContext] Failed to load user permissions:",
        error,
      );

      // Check if error is network/auth related
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError")
      ) {
        console.error(
          "[PermissionContext] Network error - backend unreachable",
        );
        toast.error(
          "Cannot connect to server. Please check your internet connection.",
          {
            duration: 5000,
          },
        );
      } else if (
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        console.error(
          "[PermissionContext] Unauthorized - session may be expired",
        );
        toast.error("Session expired. Please login again.", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => (window.location.href = "/login"),
          },
        });

        // Clear auth state
        setUserRole(null);
        setLoading(false);
        return;
      }

      // For Teifi users and superadmins, provide access even on server error
      const isSuperAdmin = isSuperAdminUser(user.email);
      const isTeifi =
        user.email &&
        (user.email.endsWith("@teifi.com") ||
          user.email.endsWith("@teifi.ca"));

      if (isSuperAdmin || isTeifi) {
        const role = isSuperAdmin ? "superadmin" : "admin";
        const userRole: UserRole = {
          id: user.id,
          email: user.email,
          role: role,
          permissions: ROLE_DEFINITIONS[role].permissions,
          customerId: "global",
          customerName: "Global Access",
          projects: ["Admin Dashboard"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          status: "active",
        };

        setUserRole(userRole);
        setLoading(false);
        
        toast.info(
          `${isSuperAdmin ? "Superadmin" : "Admin"} access granted`,
        );
      } else {
        toast.error("Failed to load user permissions");

        // Fallback to local role assignment on error
        const defaultRole = getDefaultRole(user.email);
        const userRole: UserRole = {
          id: user.id,
          email: user.email,
          role: defaultRole,
          permissions:
            ROLE_DEFINITIONS[defaultRole].permissions,
          customerId: "CUST-2024-002",
          customerName: "Guillevin",
          projects: ["Electrical Distribution Platform"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          status: "active",
        };

        setUserRole(userRole);
        
        // PERFORMANCE: Set loading=false even on error
        setLoading(false);
      }
    } finally {
      // PERFORMANCE: Loading is now managed inside each code path
      // Each path calls setLoading(false) after setting userRole
      // This ensures UI renders as soon as permissions are available
    }
  }, [
    user?.email,
    user?.id,
    session?.access_token,
    getDefaultRole,
    isSuperAdminUser,
  ]);

  // REFACTORED: Fetch superadmin list in BACKGROUND (non-blocking)
  // This should NOT block UI rendering or permission loading
  useEffect(() => {
    if (
      user?.id &&
      session?.access_token &&
      !superadminListFetchedRef.current
    ) {
      superadminListFetchedRef.current = true;
      
      // BACKGROUND: Fetch superadmin list WITHOUT blocking
      // Use setTimeout to ensure it runs AFTER initial render
      setTimeout(() => {
        fetchSuperadminList();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only user.id - prevents re-run on session reference changes

  // OPTIMIZED: Load permissions FIRST (critical), team access in BACKGROUND
  // This allows UI to render immediately with permissions, sidebar loads async
  useEffect(() => {
    if (user && session?.access_token) {
      // Check if already loaded for this user
      const currentUserId = user.id;
      const lastLoadedUserId = permissionsLoadedRef.current
        ? userRole?.id
        : null;

      // Only load if:
      // 1. Never loaded before, OR
      // 2. User ID changed (real login/logout)
      const shouldLoad =
        !permissionsLoadedRef.current ||
        currentUserId !== lastLoadedUserId;

      if (shouldLoad) {
        // SECURITY: Do not log permission operations
        setLoading(true);

        // PRIORITY LOADING: Load permissions FIRST (sets loading=false internally)
        loadUserPermissions().then(() => {
          // SECURITY: Do not log permission loading status
        });

        // BACKGROUND LOADING: Load team access WITHOUT blocking UI
        loadTeamAccess().then(() => {
          // SECURITY: Do not log team access loading status
        });
      }
    } else {
      setUserRole(null);
      setLoading(false);
      permissionsLoadedRef.current = false; // Reset on logout
      teamAccessLoadedRef.current = false;
      superadminListFetchedRef.current = false; // Reset superadmin list flag
    }
  }, [user?.id, session?.access_token]); // Depend on both user and session

  //V2.0: Listen for permission updates from AuthContext
  useEffect(() => {
    const handleStorageChange = () => {
      const storedRole = localStorage.getItem("user_role");
      const storedPermissions = localStorage.getItem(
        "user_permissions",
      );

      if (storedRole && storedPermissions && user) {
        try {
          const permissions = JSON.parse(storedPermissions);

          // Update userRole with new data
          setUserRole((prev) =>
            prev
              ? {
                  ...prev,
                  role: storedRole as Role,
                  permissions: permissions,
                }
              : null,
          );
        } catch (error) {
          console.error(
            "[PermissionContext] Failed to parse stored permissions:",
            error,
          );
        }
      }
    };

    // Listen for storage events
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange,
      );
    };
  }, [user]);

  // Memoized permission check to prevent re-computation
  const hasPermission = useCallback(
    (
      permission: Permission | Permission[],
      options: PermissionCheckOptions = {},
    ): boolean => {
      return checkUserPermission(
        userRole,
        permission,
        options,
        superadminEmailsRef.current,
      );
    },
    [userRole],
  );

  //Memoized role check
  const hasRole = useCallback(
    (role: Role | Role[]): boolean => {
      if (!userRole || !userRole.isActive) {
        return false;
      }

      // Superadmin has all roles - includes access to all organizations
      if (
        userRole.role === "superadmin" ||
        (userRole.email &&
          superadminEmailsRef.current.includes(
            userRole.email.toLowerCase().trim(),
          ))
      ) {
        return true;
      }

      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(userRole.role);
    },
    [userRole],
  );

  /**
   * Check if user has access to specific organization
   * Superadmin automatically has access to all organizations
   *Memoized for performance
   */
  const hasOrganizationAccess = useCallback(
    (organizationId: string): boolean => {
      // Superadmin has access to all organizations
      if (
        userRole?.role === "superadmin" ||
        (userRole?.email && isSuperAdminUser(userRole.email))
      ) {
        return true;
      }

      // Check if user has explicit permission for this organization
      if (userRole?.customerId === organizationId) {
        return true;
      }

      return false;
    },
    [userRole],
  );

  const assignRole = async (
    email: string,
    role: Role,
    customerId?: string,
    projects?: string[],
  ): Promise<void> => {
    try {
      // TODO: Implement real API call to backend
      // await fetch('/api/assign-role', { method: 'POST', body: JSON.stringify({ email, role, customerId, projects }) });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(
        `Role "${ROLE_DEFINITIONS[role].name}" assigned to ${email}`,
      );

      // If assigning to current user, refresh permissions
      if (email === user?.email) {
        await refreshPermissions();
      }
    } catch (error) {
      console.error("Failed to assign role:", error);
      toast.error("Failed to assign role");
      throw error;
    }
  };

  const updateUserRole = async (
    roleData: Partial<UserRole>,
  ): Promise<void> => {
    try {
      // TODO: Implement real API call to update user role
      // await fetch('/api/update-role', { method: 'PUT', body: JSON.stringify(roleData) });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (userRole) {
        const updatedRole = {
          ...userRole,
          ...roleData,
          updatedAt: new Date().toISOString(),
        };
        setUserRole(updatedRole);
      }

      toast.success("User role updated successfully");
    } catch (error) {
      console.error("Failed to update user role:", error);
      toast.error("Failed to update user role");
      throw error;
    }
  };

  const getAllUserRoles = async (): Promise<UserRole[]> => {
    try {
      // TODO: Implement real API call to fetch user roles
      // const response = await fetch('/api/user-roles');
      // const roles = await response.json();

      // For now, return current user only until backend API is implemented
      const currentUserRoles: UserRole[] = [];

      if (userRole) {
        currentUserRoles.push(userRole);
      }

      return currentUserRoles;
    } catch (error) {
      console.error("Failed to fetch user roles:", error);
      toast.error("Failed to fetch user roles");
      return [];
    }
  };

  const revokeAccess = async (email: string): Promise<void> => {
    try {
      // TODO: Implement real API call to revoke access
      // await fetch('/api/revoke-access', { method: 'DELETE', body: JSON.stringify({ email }) });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`Access revoked for ${email}`);
    } catch (error) {
      console.error("Failed to revoke access:", error);
      toast.error("Failed to revoke access");
      throw error;
    }
  };

  // OPTIMIZED: Load Team Access - Now loads in PARALLEL with user permissions
  const loadTeamAccess = useCallback(async () => {
    if (!user || !session?.access_token) {
      // No user or token - skip silently
      console.log(
        "[PermissionContext] Skipping team access - no user or token",
      );
      setTeamsLoading(false); // Set to false when skipping
      return;
    }

    // DEDUPLICATION: Prevent multiple simultaneous loads
    if (teamAccessLoadedRef.current) {
      // Already loaded - skip silently
      console.log(
        "[PermissionContext] Team access already loaded - skipping",
      );
      setTeamsLoading(false); // Set to false when already loaded
      return;
    }

    // CRITICAL: Define cache key at function scope so it's available everywhere
    const cacheKey = `permissions:team-hierarchy:${user.id}`;

    // OPTIMIZED: Superadmin/Admin gets ALL teams - no API call needed
    if (
      userRole?.role === "superadmin" ||
      userRole?.role === "admin"
    ) {
      console.log(
        "[PermissionContext] Admin/Superadmin - skipping team hierarchy API call",
      );
      setPermissionModel("customer-level");
      teamAccessLoadedRef.current = true;
      setTeamsLoading(false); // Set to false for admins
      // Don't set accessibleTeams for admins - they check role in hasTeamAccess
      return;
    }

    // PERFORMANCE: Check cache first
    const cachedData = globalCache.get<{
      hierarchy: any[];
      teamIds: string[];
    }>(cacheKey, { fallback: "sessionStorage" });

    if (cachedData) {
      // SECURITY: Do not log cached data
      setTeamHierarchyState(cachedData.hierarchy);
      setAccessibleTeams(cachedData.teamIds);
      setPermissionModel("customer-level");
      teamAccessLoadedRef.current = true;
      setTeamsLoading(false); // Set to false when using cached data
      return;
    }

    try {
      // CRITICAL: Set teamsLoading to true BEFORE API call
      setTeamsLoading(true);
      
      // Load team hierarchy from API (parallel with user permissions)
      console.log(
        "[PermissionContext] Fetching team hierarchy from API (parallel load)...",
      );
      teamAccessLoadedRef.current = true; // Mark as loading

      // CRITICAL: Ensure token is set in apiClient
      if (session.access_token) {
        const expiresAt = session.expires_at ? session.expires_at * 1000 : undefined;
        apiClient.setAccessToken(session.access_token, expiresAt);
      }

      // CRITICAL: Use apiClient instead of raw fetch
      const result = await apiClient.get('/teams/hierarchy');

      if (!result.success) {
        console.error(
          "[PermissionContext] Failed to load team hierarchy:",
          result.error,
        );
        setAccessibleTeams([]);
        setTeamHierarchyState([]);
        setPermissionModel(null);
        teamAccessLoadedRef.current = false; // Reset on error
        setTeamsLoading(false); // Set to false on error
        return;
      }

      if (result.success && result.data) {
        // Extract team IDs from hierarchy (customer > teams structure)
        const teamIds: string[] = [];

        for (const customer of result.data) {
          if (
            customer.children &&
            Array.isArray(customer.children)
          ) {
            for (const team of customer.children) {
              if (team.id) {
                teamIds.push(team.id);
              }
            }
          }
        }

        console.log(
          "[PermissionContext] Team hierarchy loaded:",
          {
            customerGroups: result.data.length,
            teams: teamIds.length,
            teamIds: teamIds,
          },
        );

        // Store in state
        setTeamHierarchyState(result.data);
        setAccessibleTeams(teamIds);
        setPermissionModel("customer-level");

        // CACHE for 10 minutes with sessionStorage persistence
        globalCache.set(
          cacheKey,
          { hierarchy: result.data, teamIds },
          10 * 60 * 1000, // 10 minute TTL
          { persist: true, storage: "sessionStorage" },
        );

        console.log(
          "[PermissionContext] Team hierarchy cached for 10 minutes",
        );
      } else {
        console.warn(
          "[PermissionContext] No team data in response",
        );
        setAccessibleTeams([]);
        setTeamHierarchyState([]);
        setPermissionModel(null);
        teamAccessLoadedRef.current = false; // Reset if no data
        setTeamsLoading(false); // Set to false if no data
      }
    } catch (error) {
      console.error(
        "[PermissionContext] Error loading team access:",
        error,
      );
      setAccessibleTeams([]);
      setTeamHierarchyState([]);
      setPermissionModel(null);
      teamAccessLoadedRef.current = false; // Reset on error
      setTeamsLoading(false); // Set to false on error
    } finally {
      setTeamsLoading(false); // NEW: Set teamsLoading to false after loading
    }
  }, [user, session, userRole]);

  //Refresh team access (Force reload)
  const refreshTeamAccess =
    useCallback(async (): Promise<void> => {
      console.log(
        "[PermissionContext] Force refreshing team access...",
      );

      // Clear cache
      if (user?.id) {
        const cacheKey = `permissions:team-hierarchy:${user.id}`;
        globalCache.delete(cacheKey);
        globalCache.clearStorage("sessionStorage", cacheKey);
      }

      // Reset deduplication flag to allow reload
      teamAccessLoadedRef.current = false;

      // Clear state first
      setAccessibleTeams([]);
      setTeamHierarchyState([]);
      setPermissionModel(null);

      // Reload from server
      await loadTeamAccess();
    }, [loadTeamAccess, user]);

  // REFACTORED: Refresh all permissions (Force reload including superadmin list)
  const refreshPermissions =
    useCallback(async (): Promise<void> => {
      // Reset deduplication flags to allow reload
      permissionsLoadedRef.current = false;
      teamAccessLoadedRef.current = false;

      // Reload superadmin list, permissions, and team access
      await fetchSuperadminList();
      await loadUserPermissions();
      await loadTeamAccess();
    }, [
      fetchSuperadminList,
      loadUserPermissions,
      loadTeamAccess,
    ]);

  //Check if user has access to specific team
  const hasTeamAccess = useCallback(
    (teamId: string): boolean => {
      // Superadmin has access to all teams
      if (userRole?.role === "superadmin") {
        console.log(
          `[hasTeamAccess] Superadmin - auto allow team ${teamId}`,
        );
        return true;
      }

      // Admin has access to all teams
      if (userRole?.role === "admin") {
        console.log(
          `[hasTeamAccess] Admin - auto allow team ${teamId}`,
        );
        return true;
      }

      // Check if team is in accessible teams list
      const hasAccess = accessibleTeams.includes(teamId);
      console.log(`[hasTeamAccess] Team ${teamId}:`, {
        hasAccess,
        accessibleTeamsCount: accessibleTeams.length,
        accessibleTeamIds: accessibleTeams,
      });
      return hasAccess;
    },
    [userRole, accessibleTeams],
  );

  // REMOVED: Team hierarchy now loads in parallel with user permissions
  // See combined useEffect above for parallel loading strategy

  //Memoize context value to prevent unnecessary re-renders of children
  const value = useMemo<PermissionContextType>(
    () => ({
      userRole,
      loading,
      teamsLoading, // NEW: Include teamsLoading in context
      hasPermission,
      hasRole,
      hasOrganizationAccess,
      hasTeamAccess,
      accessibleTeams,
      teamHierarchy, //NEW: Share hierarchy data
      permissionModel,
      refreshTeamAccess,
      assignRole,
      updateUserRole,
      getAllUserRoles,
      revokeAccess,
      refreshPermissions,
    }),
    [
      userRole,
      loading,
      teamsLoading, // NEW: Include teamsLoading in deps
      hasPermission,
      hasRole,
      hasOrganizationAccess,
      hasTeamAccess,
      accessibleTeams,
      teamHierarchy, //NEW: Include in deps
      permissionModel,
      refreshTeamAccess,
      refreshPermissions,
    ],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error(
      "usePermissions must be used within a PermissionProvider",
    );
  }
  return context;
}

// Utility hook for checking permissions in components
export function useHasPermission(
  permission: Permission | Permission[],
  options?: PermissionCheckOptions,
): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission, options);
}

// Utility hook for checking roles in components
export function useHasRole(role: Role | Role[]): boolean {
  const { hasRole } = usePermissions();
  return hasRole(role);
}