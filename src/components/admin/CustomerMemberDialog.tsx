import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Users,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Mail,
  Shield,
  Info,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { adminService } from "../../services/adminService";
import { ScrollArea } from "../ui/scroll-area";

interface CustomerMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onMembersUpdated: () => void;
}

interface Member {
  userId: string; // Schema V2.0: camelCase
  email: string;
  name?: string;
  role: string;
  status?: string;
  assignedAt: string; // Schema V2.0: camelCase
  assignedBy?: string;
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
}

const ROLE_OPTIONS = [
  { value: "superadmin", label: "Super Admin", color: "destructive" },
  { value: "admin", label: "Admin", color: "destructive" },
  { value: "client_manager", label: "Client Manager", color: "default" },
  { value: "client_user", label: "Client User", color: "default" },
  { value: "tester", label: "Tester", color: "secondary" },
  { value: "viewer", label: "Viewer", color: "outline" },
] as const;

export function CustomerMemberDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onMembersUpdated,
}: CustomerMemberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("client_user");
  const [error, setError] = useState<string | null>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, customerId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load customer members
      const membersResult = await adminService.getCustomerMembers(customerId);
      if (membersResult.success && membersResult.members) {
        setMembers(membersResult.members);
      }

      // Load all users for dropdown
      const usersResult = await adminService.getUsers();
      if (usersResult.success && usersResult.data) {
        setAllUsers(usersResult.data.users);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.addCustomerMember(
        customerId,
        selectedUserId,
        selectedRole
      );

      if (result.success) {
        toast.success("Member added successfully");
        setSelectedUserId("");
        setSelectedRole("client_user");
        await loadData();
        onMembersUpdated();
      } else {
        toast.error(result.error || "Failed to add member");
      }
    } catch (err) {
      console.error("Error adding member:", err);
      toast.error("Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, email: string) => {
    if (!confirm(`Remove ${email} from ${customerName}?`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await adminService.removeCustomerMember(customerId, userId);
      if (result.success) {
        toast.success("Member removed successfully");
        await loadData();
        onMembersUpdated();
      } else {
        toast.error(result.error || "Failed to remove member");
      }
    } catch (err) {
      console.error("Error removing member:", err);
      toast.error("Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  // Get users not already in customer
  const availableUsers = allUsers.filter(
    (user) => !members.some((m) => m.userId === user.id)
  );

  const getRoleBadgeVariant = (role: string) => {
    const roleOption = ROLE_OPTIONS.find((r) => r.value === role);
    return roleOption?.color || "default";
  };

  const getRoleLabel = (role: string) => {
    const roleOption = ROLE_OPTIONS.find((r) => r.value === role);
    return roleOption?.label || role;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Members - {customerName}</DialogTitle>
          <DialogDescription>
            Add or remove members and manage their roles for this customer
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6">
            {/* Add Member Section */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Plus className="h-4 w-4" />
                Add New Member
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={loading || availableUsers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.user_metadata?.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedRole}
                    onValueChange={setSelectedRole}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddMember}
                    disabled={!selectedUserId || loading}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              {availableUsers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  All users are already members of this customer
                </p>
              )}
            </div>

            {/* Members List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  Current Members ({members.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No members assigned yet. Add members above.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {member.name || member.email}
                              </div>
                              {member.name && (
                                <div className="text-xs text-muted-foreground">
                                  {member.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(member.role) as any}>
                            <Shield className="h-3 w-3 mr-1" />
                            {getRoleLabel(member.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.assignedAt ? new Date(member.assignedAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveMember(member.userId, member.email)
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
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
