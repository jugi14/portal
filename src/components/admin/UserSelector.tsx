/**
 * User Selector Component
 * 
 * Features:
 * - Search/filter users by name or email
 * - Exclude superadmin users from selection
 * - Display user info (name, email, current role)
 * - Auto-populate form when user is selected
 */

import React, { useState, useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Search, User, Mail, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import type { User as UserType } from "../../services/adminService";

interface UserSelectorProps {
  value?: string; // Selected user ID
  onSelect: (user: SelectedUserInfo | null) => void;
  customerId?: string; // Customer ID to check if user is already member
  organizationId?: string; // Legacy: alias for customerId
  excludeUserIds?: string[]; // Additional user IDs to exclude
  disabled?: boolean;
  className?: string;
}

export interface SelectedUserInfo {
  userId: string;
  email: string;
  name: string;
  currentRole?: string;
  currentOrganization?: string;
}

export function UserSelector({
  value,
  onSelect,
  customerId,
  organizationId, // Legacy support
  excludeUserIds = [],
  disabled = false,
  className = "",
}: UserSelectorProps) {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [existingMemberIds, setExistingMemberIds] = useState<string[]>([]);

  // Support both customerId (new) and organizationId (legacy)
  const effectiveCustomerId = customerId || organizationId;

  // Load all users and existing members on mount
  useEffect(() => {
    if (session?.access_token) {
      // Set access token for adminService
      adminService.setAccessToken(session.access_token);
      loadUsers();
      if (effectiveCustomerId) {
        loadExistingMembers();
      }
    }
  }, [effectiveCustomerId, session?.access_token]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await adminService.getUsers();
      
      if (result.success && result.data) {
        setUsers(result.data.users);
      } else {
        throw new Error(result.error || "Failed to load users");
      }
    } catch (err) {
      console.error("[UserSelector] Error loading users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const loadExistingMembers = async () => {
    try {
      const result = await adminService.getCustomerMembers(effectiveCustomerId!);
      
      if (result.success && result.members) {
        const memberIds = result.members.map(m => m.userId || m.user_id);
        setExistingMemberIds(memberIds);
      }
    } catch (err) {
      console.warn("[UserSelector] Error loading existing members:", err);
      // Don't block the UI if this fails
    }
  };

  // Filter users: exclude superadmins, existing members, and excluded IDs
  const availableUsers = useMemo(() => {
    return users.filter(user => {
      // Exclude superadmins
      const hasSuperAdminRole = user.permissions?.some(p => p.role === 'superadmin');
      if (hasSuperAdminRole) return false;
      
      // Exclude existing organization members
      if (existingMemberIds.includes(user.id)) return false;
      
      // Exclude specific user IDs
      if (excludeUserIds.includes(user.id)) return false;
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = user.name?.toLowerCase().includes(query);
        const emailMatch = user.email?.toLowerCase().includes(query);
        return nameMatch || emailMatch;
      }
      
      return true;
    });
  }, [users, excludeUserIds, existingMemberIds, searchQuery]);

  // Get selected user info
  const selectedUser = useMemo(() => {
    if (!value) return null;
    return users.find(u => u.id === value);
  }, [value, users]);

  // Handle user selection
  const handleSelect = (userId: string) => {
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      onSelect(null);
      return;
    }

    // Get current role and organization from permissions
    const primaryPermission = user.permissions?.[0];
    
    onSelect({
      userId: user.id,
      email: user.email,
      name: user.name,
      currentRole: primaryPermission?.role,
      currentOrganization: primaryPermission?.customers?.name,
    });
  };

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Select User</Label>
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading users...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-2">
        <Label>Select User</Label>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{typeof error === 'string' ? error : error instanceof Error ? error.message : 'An error occurred'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <Label htmlFor="user-search" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Select User
          <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground mt-1">
          Search and select a user to add to this organization
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="user-search"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {/* User Select */}
      <Select value={value} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger style={{ position: 'relative', zIndex: 1 }}>
          <SelectValue placeholder="Choose a user from the list">
            {selectedUser && (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {selectedUser.name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selectedUser.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  ({selectedUser.email})
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent container={document.body} className="max-h-[300px]">
          {availableUsers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "No users found matching your search" : "No users available"}
            </div>
          ) : (
            availableUsers.map((user) => {
              const primaryPermission = user.permissions?.[0];
              
              return (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-start gap-3 py-1">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {user.name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user.name}</p>
                        {primaryPermission?.role && (
                          <Badge variant="outline" className="text-xs">
                            {primaryPermission.role}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </p>
                      {primaryPermission?.customers?.name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Current org: {primaryPermission.customers.name}
                        </p>
                      )}
                    </div>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>

      {/* Selected User Info */}
      {selectedUser && (
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              {selectedUser.permissions?.[0] && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    Current Role: {selectedUser.permissions[0].role}
                  </Badge>
                  {selectedUser.permissions[0].customers?.name && (
                    <span className="text-xs text-muted-foreground">
                      in {selectedUser.permissions[0].customers.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info about excluded users */}
      <div className="text-xs text-muted-foreground">
        <p>ℹ️ Superadmins and existing members are excluded from this list</p>
        {availableUsers.length > 0 && (
          <p className="mt-1">
            Showing {availableUsers.length} of {users.length} total users
          </p>
        )}
      </div>
    </div>
  );
}
