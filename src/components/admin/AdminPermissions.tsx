import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Alert, AlertDescription } from "../ui/alert";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Shield, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Settings,
  Key,
  UserCheck,
  UserX,
  Globe,
  Building2
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { toast } from "sonner@2.0.3";
import { useAdminUsers, useAdminOrganizations } from "../../hooks/useCache";
import { SuperadminManagement } from "./SuperadminManagement";

// Role definitions
const ROLE_DEFINITIONS = {
  superadmin: {
    name: 'Super Administrator',
    color: 'bg-purple-100 text-purple-800',
    icon: '👑',
    description: 'Full system access with all permissions',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues', 'delete_issues',
      'manage_users', 'manage_customers', 'manage_teams',
      'view_admin', 'manage_system', 'manage_permissions',
      'access_all_customers', 'manage_linear_integration',
      'view_analytics', 'export_data', 'manage_security'
    ]
  },
  admin: {
    name: 'Administrator',
    color: 'bg-red-100 text-red-800',
    icon: '🛡️',
    description: 'Full administrative access to customers and users',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues', 'delete_issues',
      'manage_users', 'manage_customers', 'manage_teams',
      'view_admin', 'view_analytics', 'export_data'
    ]
  },
  client_manager: {
    name: 'Client Manager',
    color: 'bg-blue-100 text-blue-800',
    icon: '🏢',
    description: 'Manage client projects and team assignments',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues',
      'manage_teams', 'view_analytics'
    ]
  },
  client_user: {
    name: 'Client User',
    color: 'bg-green-100 text-green-800',
    icon: '👤',
    description: 'Standard client access to assigned projects',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues'
    ]
  },
  tester: {
    name: 'Tester',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '🧪',
    description: 'Testing and quality assurance focused access',
    permissions: [
      'view_issues', 'create_issues', 'edit_issues'
    ]
  },
  viewer: {
    name: 'Viewer',
    color: 'bg-gray-100 text-gray-800',
    icon: '👁️',
    description: 'Read-only access to assigned projects',
    permissions: [
      'view_issues'
    ]
  }
};

const PERMISSION_DESCRIPTIONS = {
  'view_issues': 'View issues and project data',
  'create_issues': 'Create new issues and reports',
  'edit_issues': 'Edit existing issues',
  'delete_issues': 'Delete issues (dangerous)',
  'manage_users': 'Manage user accounts and permissions',
  'manage_customers': 'Manage client organizations',
  'manage_teams': 'Assign teams to customers',
  'view_admin': 'Access admin dashboard',
  'manage_system': 'System configuration and settings',
  'manage_permissions': 'Modify role permissions',
  'access_all_customers': 'Access all customer data',
  // REMOVED: 'manage_linear_integration' - No longer used (system-wide Linear API only)
  'view_analytics': 'View reports and analytics',
  'export_data': 'Export system data',
  'manage_security': 'Security and audit settings'
};

interface UserPermission {
  id: string;
  user_id: string;
  customer_id: string;
  role: string;
  status: 'active' | 'pending' | 'rejected';
  created_at: string;
  customers: {
    id: string;
    name: string;
  };
}

interface UserWithPermissions {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at?: string;
  status: 'active' | 'pending' | 'rejected';
  permissions: UserPermission[];
}

export function AdminPermissions() {
  const { session } = useAuth();
  
  // OPTIMIZED: Use ref to prevent re-renders on token updates
  const isTokenSet = React.useRef(false);
  
  // Use cache hooks for data - only enable when session exists
  const { 
    data: users, 
    loading: usersLoading, 
    error: usersError, 
    refresh: refreshUsers 
  } = useAdminUsers({ enabled: !!session?.access_token });
  
  const { 
    data: organizations, 
    loading: orgsLoading,
    error: orgsError,
    refresh: refreshOrganizations 
  } = useAdminOrganizations({ enabled: !!session?.access_token });

  // Local state
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [editingPermission, setEditingPermission] = useState<UserPermission | null>(null);
  const [showCreatePermissionDialog, setShowCreatePermissionDialog] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOrganization, setFilterOrganization] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for creating/editing permissions
  const [permissionForm, setPermissionForm] = useState({
    user_id: '',
    customer_id: '',
    role: 'viewer'
  });

  // OPTIMIZED: Set token only once
  useEffect(() => {
    if (session?.access_token && !isTokenSet.current) {
      // SECURITY: Do not log token operations
      adminService.setAccessToken(session.access_token);
      isTokenSet.current = true;
    }
  }, [session?.access_token]);

  // OPTIMIZED: Memoize filtered users to prevent recalculation on every render
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    
    return users.filter((user: UserWithPermissions) => {
    if (searchQuery && !user.email.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !user.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (filterStatus !== 'all' && user.status !== filterStatus) {
      return false;
    }
    
    if (filterRole !== 'all') {
      const hasRole = user.permissions.some(p => p.role === filterRole);
      if (!hasRole) return false;
    }
    
      if (searchQuery && !user.email.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !user.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filterStatus !== 'all' && user.status !== filterStatus) {
        return false;
      }
      
      if (filterRole !== 'all') {
        const hasRole = user.permissions.some(p => p.role === filterRole);
        if (!hasRole) return false;
      }
      
      if (filterOrganization !== 'all') {
        const hasOrg = user.permissions.some(p => p.customer_id === filterOrganization);
        if (!hasOrg) return false;
      }
      
      return true;
    });
  }, [users, searchQuery, filterStatus, filterRole, filterOrganization]);

  const handleUpdateUserStatus = async (userId: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await adminService.approveUser(userId);
        toast.success('User approved successfully');
      } else {
        await adminService.rejectUser(userId);
        toast.success('User rejected successfully');
      }
      await refreshUsers();
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      toast.error(`Failed to ${action} user`);
    }
  };

  const handleUpdatePermissions = async (userId: string, permissionData: { customer_id: string; role: string }) => {
    try {
      await adminService.updateUserPermissions(userId, permissionData);
      toast.success('Permissions updated successfully');
      await refreshUsers();
      setEditingPermission(null);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await adminService.deleteUser(userId);
      toast.success('User deleted successfully');
      await refreshUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getRoleInfo = (role: string) => {
    return ROLE_DEFINITIONS[role as keyof typeof ROLE_DEFINITIONS] || {
      name: role,
      color: 'bg-gray-100 text-gray-800',
      icon: '❓',
      description: 'Unknown role',
      permissions: []
    };
  };

  if (usersLoading || orgsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading permissions...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Permissions</h2>
          <p className="text-muted-foreground">Manage user roles and access permissions</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={refreshUsers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {usersError && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{typeof usersError === 'string' ? usersError : usersError instanceof Error ? usersError.message : 'Failed to load users'}</AlertDescription>
        </Alert>
      )}

      {orgsError && (
        <Alert className="border-red-200 bg-red-50 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            Failed to load organizations: {typeof orgsError === 'string' ? orgsError : orgsError instanceof Error ? orgsError.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Role Definitions</TabsTrigger>
          <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
          <TabsTrigger value="superadmin">Superadmin Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search Users</Label>
                  <Input
                    id="search"
                    placeholder="Email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role-filter">Filter by Role</Label>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger style={{ position: 'relative', zIndex: 1 }}>
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {Object.entries(ROLE_DEFINITIONS).map(([role, info]) => (
                        <SelectItem key={role} value={role}>
                          {info.icon} {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status-filter">Filter by Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger style={{ position: 'relative', zIndex: 1 }}>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="org-filter">Filter by Organization</Label>
                  <Select 
                    value={filterOrganization} 
                    onValueChange={setFilterOrganization}
                    disabled={orgsLoading}
                  >
                    <SelectTrigger style={{ position: 'relative', zIndex: 1 }}>
                      <SelectValue placeholder={
                        orgsLoading 
                          ? "Loading organizations..." 
                          : organizations && organizations.length > 0
                          ? "All organizations"
                          : "No organizations available"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      <SelectItem value="global">Global Access</SelectItem>
                      {orgsLoading ? (
                        <SelectItem value="loading" disabled>
                          <RefreshCw className="h-3 w-3 animate-spin mr-2 inline" />
                          Loading organizations...
                        </SelectItem>
                      ) : organizations && organizations.length > 0 ? (
                        organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            <Building2 className="h-3 w-3 mr-2 inline" />
                            {org.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-orgs" disabled>
                          <AlertTriangle className="h-3 w-3 mr-2 inline" />
                          No organizations found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Users ({filteredUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Organizations</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(user.status)}
                            <Badge className={getStatusColor(user.status)}>
                              {user.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.permissions.map((perm, idx) => {
                              const roleInfo = getRoleInfo(perm.role);
                              return (
                                <Badge key={idx} className={roleInfo.color}>
                                  {roleInfo.icon} {roleInfo.name}
                                </Badge>
                              );
                            })}
                            {user.permissions.length === 0 && (
                              <Badge variant="outline">No permissions</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.permissions.map((perm, idx) => (
                              <Badge key={idx} variant="outline">
                                {perm.customers.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleUpdateUserStatus(user.id, 'approve')}
                                >
                                  <UserCheck className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleUpdateUserStatus(user.id, 'reject')}
                                >
                                  <UserX className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(ROLE_DEFINITIONS).map(([role, info]) => (
              <Card key={role}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    {info.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Permissions:</Label>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      {info.permissions.map((permission) => (
                        <div key={permission} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>{PERMISSION_DESCRIPTIONS[permission as keyof typeof PERMISSION_DESCRIPTIONS] || permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <p className="text-sm text-muted-foreground">
                Overview of what each role can do
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      {Object.entries(ROLE_DEFINITIONS).map(([role, info]) => (
                        <TableHead key={role} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>{info.icon}</span>
                            <span className="text-xs">{info.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(PERMISSION_DESCRIPTIONS).map(([permission, description]) => (
                      <TableRow key={permission}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{description}</div>
                            <div className="text-xs text-muted-foreground">{permission}</div>
                          </div>
                        </TableCell>
                        {Object.entries(ROLE_DEFINITIONS).map(([role, info]) => (
                          <TableCell key={role} className="text-center">
                            {info.permissions.includes(permission) ? (
                              <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="superadmin" className="space-y-4">
          <SuperadminManagement />
        </TabsContent>
      </Tabs>

      {/* Edit User Permissions Dialog */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User Permissions - {selectedUser.name}</DialogTitle>
              <DialogDescription>
                Manage permissions for {selectedUser.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Email: {selectedUser.email}
              </div>
              
              {selectedUser.permissions.map((perm, idx) => {
                const roleInfo = getRoleInfo(perm.role);
                const organization = organizations?.find(org => org.id === perm.customer_id);
                
                return (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={roleInfo.color}>
                              {roleInfo.icon} {roleInfo.name}
                            </Badge>
                            <span className="text-sm">in</span>
                            <Badge variant="outline">
                              <Building2 className="h-3 w-3 mr-1" />
                              {organization?.name || 'Unknown Organization'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(perm.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPermission(perm)}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {selectedUser.permissions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  This user has no permissions assigned.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}