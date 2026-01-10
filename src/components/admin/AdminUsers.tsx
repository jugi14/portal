import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Alert, AlertDescription } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield,
  RefreshCw,
  Search,
  AlertCircle,
  UserPlus,
  Mail,
  Calendar
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../services/apiClient";
import { UserFormDialog } from "./UserFormDialog";
import { EditUserDialog } from "./EditUserDialog";
import { toast } from "sonner@2.0.3";

// ROLE DEFINITIONS
const ROLE_CONFIG = {
  'superadmin': { 
    name: 'Super Admin', 
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  'admin': { 
    name: 'Admin', 
    color: 'bg-red-100 text-red-700 border-red-200'
  },
  'client_manager': { 
    name: 'Client Manager', 
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  'client_user': { 
    name: 'Client User', 
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  'tester': { 
    name: 'Tester', 
    color: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  'viewer': { 
    name: 'Viewer', 
    color: 'bg-gray-100 text-gray-700 border-gray-200'
  }
} as const;

// USER TYPE (Schema V2.0)
interface User {
  id: string;
  email: string;
  name: string;
  role: keyof typeof ROLE_CONFIG;
  status?: string;
  customers?: Array<{
    id: string;
    name: string;
    status: string;
    assignedAt?: string; // Schema V2.0: camelCase
  }>;
  customerCount?: number; // Schema V2.0: camelCase
  createdAt: string; // Schema V2.0: camelCase
  updatedAt?: string; // Schema V2.0: camelCase
  lastSignInAt?: string; // Schema V2.0: camelCase
}

export function AdminUsers() {
  const { session } = useAuth();
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Set access token on mount
  useEffect(() => {
    if (session?.access_token) {
      apiClient.setAccessToken(session.access_token);
      // SECURITY: Do not log token operations
    }
  }, [session?.access_token]);

  // Load users
  const loadUsers = async () => {
    if (!session?.access_token) {
      console.warn('[AdminUsers] No access token');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get<{ users: User[]; count: number }>('/admin/users');
      
      if (response.success && response.data) {
        const userList = response.data.users || [];
        setUsers(userList);
      } else {
        const errorMsg = response.error || 'Failed to load users';
        console.error('[AdminUsers] Load failed:', errorMsg);
        setError(errorMsg);
        setUsers([]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load users';
      console.error('[AdminUsers] Exception:', err);
      setError(errorMsg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadUsers();
  }, [session?.access_token]);

  // Delete user
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Delete user "${userEmail}"? This action cannot be undone.`)) return;
    
    try {
      
      const response = await apiClient.delete(`/admin/users/${userId}`);
      
      if (response.success) {
        toast.success('User deleted successfully');
        await loadUsers();
      } else {
        toast.error(response.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('[AdminUsers] Delete error:', error);
      toast.error('Failed to delete user');
    }
  };

  // Edit user
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  // Refresh
  const handleRefresh = async () => {
    await loadUsers();
    toast.success('Users refreshed');
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Failed to load users</p>
            <p className="text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadUsers}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            User Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            {roleFilter !== 'all' && ` • Filtered by ${ROLE_CONFIG[roleFilter as keyof typeof ROLE_CONFIG]?.name}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={() => setCreateDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Filter by Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
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
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || roleFilter !== 'all' 
                  ? 'No users match your filters' 
                  : 'No users found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm text-primary">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={ROLE_CONFIG[user.role]?.color || 'bg-gray-100 text-gray-700'}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {ROLE_CONFIG[user.role]?.name || user.role}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {user.customerCount || 0} customer{user.customerCount === 1 ? '' : 's'}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(user.createdAt)}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <UserFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadUsers}
      />
      
      {selectedUser && (
        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={loadUsers}
        />
      )}
    </div>
  );
}
