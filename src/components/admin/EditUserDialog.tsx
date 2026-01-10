import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import {
  User,
  Shield,
  Building2,
  AlertCircle,
  Save,
  Crown,
  Loader2,
  Mail,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { apiClient } from '../../services/apiClient';

interface EditUserDialogProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status?: string;
    customers?: Array<{
      id: string;
      name: string;
      status: string;
    }>;
    customerCount?: number; // Schema V2.0: camelCase
    createdAt: string; // Schema V2.0: camelCase
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ROLE DEFINITIONS
const ROLE_CONFIG = {
  'superadmin': {
    name: 'Super Admin',
    level: 6,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Crown,
  },
  'admin': {
    name: 'Admin',
    level: 5,
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Shield,
  },
  'client_manager': {
    name: 'Client Manager',
    level: 4,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: User,
  },
  'client_user': {
    name: 'Client User',
    level: 3,
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: User,
  },
  'tester': {
    name: 'Tester',
    level: 2,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: User,
  },
  'viewer': {
    name: 'Viewer',
    level: 1,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: User,
  },
} as const;

interface Customer {
  id: string;
  name: string;
  status: string;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditUserDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    role: 'viewer' as keyof typeof ROLE_CONFIG,
  });

  // Initialize form when user changes
  useEffect(() => {
    if (user && open) {
      setFormData({
        name: user.name || '',
        role: user.role as keyof typeof ROLE_CONFIG || 'viewer',
      });

      // Set currently assigned customers
      const assignedCustomerIds = user.customers?.map(c => c.id) || [];
      setSelectedCustomers(assignedCustomerIds);

      loadAllCustomers();
    }
  }, [user, open]);

  const loadAllCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const response = await apiClient.get<{ customers: Customer[]; count: number }>('/admin/customers');

      if (response.success && response.data) {
        setAllCustomers(response.data.customers || []);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    setIsUpdating(true);
    try {
      const response = await apiClient.put(`/admin/users/${user.id}`, {
        name: formData.name,
        role: formData.role,
        customers: selectedCustomers,
      });

      if (response.success) {
        // Check if role changed
        const roleChanged = formData.role !== user.role;
        
        if (roleChanged) {
          toast.success(
            `User role updated: ${user.role} → ${formData.role}`,
            {
              description: 'User will see updated permissions after page refresh',
              duration: 5000,
            }
          );
        } else {
          toast.success('User updated successfully');
        }
        
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('[EditUserDialog] Error:', error);
      toast.error('Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!user) return null;

  const RoleIcon = ROLE_CONFIG[formData.role as keyof typeof ROLE_CONFIG]?.icon || User;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit User
          </DialogTitle>
          <DialogDescription>
            Update user information and permissions
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">User Info</TabsTrigger>
            <TabsTrigger value="customers">Customers ({selectedCustomers.length})</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[60vh]">
              <TabsContent value="info" className="space-y-4 mt-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Joined {formatDate(user.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      User Role <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value as keyof typeof ROLE_CONFIG })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              <span>{config.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Alert>
                    <RoleIcon className="h-4 w-4" />
                    <AlertDescription>
                      <Badge variant="outline" className={ROLE_CONFIG[formData.role]?.color}>
                        {ROLE_CONFIG[formData.role]?.name}
                      </Badge>
                      {formData.role === 'superadmin' && (
                        <p className="mt-2 text-sm">
                          Super Admins have automatic access to all customers.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>

              <TabsContent value="customers" className="space-y-4 mt-4">
                {formData.role === 'superadmin' ? (
                  <Alert>
                    <Crown className="h-4 w-4 text-purple-600" />
                    <AlertDescription>
                      Super Admins automatically have access to ALL customers in the system.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Customer Access</Label>
                        <span className="text-sm text-muted-foreground">
                          {selectedCustomers.length} selected
                        </span>
                      </div>

                      {isLoadingCustomers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : allCustomers.length === 0 ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No customers available
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-2 border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                          {allCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded transition"
                            >
                              <Checkbox
                                id={`customer-${customer.id}`}
                                checked={selectedCustomers.includes(customer.id)}
                                onCheckedChange={() => toggleCustomer(customer.id)}
                              />
                              <Label
                                htmlFor={`customer-${customer.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span>{customer.name}</span>
                                  </div>
                                  <Badge variant="outline">
                                    {customer.status}
                                  </Badge>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </TabsContent>
            </ScrollArea>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
