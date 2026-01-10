import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { 
  User, 
  Shield, 
  AlertCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  UserMinus,
  Trash2
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { adminService } from "../../services/adminService";
import { usePermissions } from "../../contexts/PermissionContext";
import { UserSelector, type SelectedUserInfo } from "./UserSelector";
import { ScrollArea } from "../ui/scroll-area";

// VALID SYSTEM ROLES - Must match types/permissions.ts
const ROLE_DEFINITIONS = {
  superadmin: {
    level: 100,
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    canAssign: false, // Can only be assigned by system
    color: 'destructive' as const
  },
  admin: {
    level: 80,
    name: 'Admin',
    description: 'Full access to organization and users',
    canAssign: true,
    requiresConfirmation: true,
    color: 'destructive' as const
  },
  client_manager: {
    level: 60,
    name: 'Client Manager',
    description: 'Manage issues and team members',
    canAssign: true,
    color: 'default' as const
  },
  client_user: {
    level: 40,
    name: 'Client User',
    description: 'Create and manage own issues',
    canAssign: true,
    color: 'secondary' as const
  },
  tester: {
    level: 30,
    name: 'Tester',
    description: 'Testing and QA access',
    canAssign: true,
    color: 'outline' as const
  },
  viewer: {
    level: 10,
    name: 'Viewer',
    description: 'Read-only access',
    canAssign: true,
    color: 'outline' as const
  }
} as const;

type RoleType = keyof typeof ROLE_DEFINITIONS;

interface MemberManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onMembersUpdated: () => void;
}

interface CustomerMember {
  userId: string; // Schema V2.0: camelCase
  email: string;
  name: string;
  role: string;
  status?: string;
  assignedAt: string; // Schema V2.0: camelCase
  assignedBy?: string; // Schema V2.0: camelCase
}

export function MemberManagementDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onMembersUpdated
}: MemberManagementDialogProps) {
  const { userRole } = usePermissions();
  
  // State
  const [members, setMembers] = useState<CustomerMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUserInfo | null>(null);
  
  // Load members when dialog opens
  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, customerId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const result = await adminService.getCustomerMembers(customerId);
      
      if (result.success) {
        const memberList = result.members || [];
        setMembers(memberList);
      } else {
        console.error(`[MemberDialog] Failed to load members:`, result.error);
        toast.error(result.error || 'Failed to load members');
      }
    } catch (error) {
      console.error('[MemberDialog] Error loading members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  // Check if current user can assign this role
  const canAssignRole = (targetRole: RoleType): boolean => {
    const currentUserLevel = ROLE_DEFINITIONS[userRole as RoleType]?.level || 0;
    const targetRoleLevel = ROLE_DEFINITIONS[targetRole]?.level || 0;
    
    return currentUserLevel >= targetRoleLevel && ROLE_DEFINITIONS[targetRole].canAssign;
  };

  // Get available roles based on current user's role
  const getAvailableRoles = (): RoleType[] => {
    return (Object.keys(ROLE_DEFINITIONS) as RoleType[]).filter(role => {
      const roleConfig = ROLE_DEFINITIONS[role];
      return roleConfig.canAssign && canAssignRole(role);
    });
  };

  // Handle adding member (no role needed - user already has global role)
  const handleAddMember = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.addMemberToCustomer({
        customerId,
        userId: selectedUser.userId,
        email: selectedUser.email,
        role: selectedUser.currentRole || 'viewer' // Use user's existing role
      });

      if (result.success) {
        toast.success(`${selectedUser.name} added to ${customerName}`);
        setSelectedUser(null);
        await loadMembers();
        onMembersUpdated();
      } else {
        toast.error(result.error || 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  // Handle removing member
  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from ${customerName}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.removeMemberFromCustomer(customerId, userId);
      if (result.success) {
        toast.success(`${memberName} removed from ${customerName}`);
        await loadMembers();
        onMembersUpdated();
      } else {
        toast.error(result.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  // Handle updating member role
  const handleUpdateRole = async (userId: string, newRole: RoleType, memberName: string) => {
    if (!canAssignRole(newRole)) {
      toast.error('You do not have permission to assign this role');
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.updateMemberRole({
        customerId,
        userId,
        newRole
      });

      if (result.success) {
        toast.success(`Role updated for ${memberName}`);
        await loadMembers();
        onMembersUpdated();
      } else {
        toast.error(result.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Manage Members
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-medium text-foreground">{customerName}</span>
            <span className="text-muted-foreground">•</span>
            <span>Add or remove members for this customer</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <div className="space-y-6">
            {/* Add Member Section - Simplified */}
            <Card className="border-2 border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Add New Member</h3>
                </div>

                <div className="space-y-4">
                  {/* User Selection */}
                  <div>
                    <Label className="text-sm mb-2 block">Select User *</Label>
                    <UserSelector
                      value={selectedUser?.userId || ''}
                      onSelect={setSelectedUser}
                      customerId={customerId}
                      disabled={loading}
                    />
                    {selectedUser && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-md">
                        <p className="text-sm">
                          <span className="font-medium">{selectedUser.name}</span>
                          <span className="text-muted-foreground"> • {selectedUser.email}</span>
                        </p>
                        {selectedUser.currentRole && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">User role:</span>
                            <Badge variant="outline" className="text-xs">
                              {ROLE_DEFINITIONS[selectedUser.currentRole as RoleType]?.name || selectedUser.currentRole}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      User will be added with their existing system role. Role assignment happens when creating the user account.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleAddMember}
                      disabled={!selectedUser || loading}
                      className="w-full sm:w-auto"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add Member
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Members List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Current Members ({members.length})</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMembers}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <Card className="border-2 border-dashed">
                  <CardContent className="py-12">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium">No members yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add a member above to get started
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{member.name || member.email}</div>
                                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(ROLE_DEFINITIONS[member.role as RoleType] || ROLE_DEFINITIONS.viewer).color}>
                              {(ROLE_DEFINITIONS[member.role as RoleType] || ROLE_DEFINITIONS.viewer).name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {member.assignedAt ? new Date(member.assignedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveMember(member.userId, member.name || member.email)
                              }
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>

            {/* Security Notice */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Security:</strong> All permission changes are logged and audited.
                Members will only have access to teams they are explicitly assigned to.
              </AlertDescription>
            </Alert>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
