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
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import {
  User,
  Mail,
  Shield,
  Building2,
  AlertCircle,
  Save,
  Crown,
  Lock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { apiClient } from '../../services/apiClient';
import { validateName, validateEmail, validatePassword } from '../../utils/inputValidation';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ROLE DEFINITIONS
const ROLE_CONFIG = {
  'superadmin': {
    name: 'Super Admin',
    level: 6,
    color: 'bg-purple-600 text-white',
    description: 'Complete system access',
    icon: Crown,
  },
  'admin': {
    name: 'Admin',
    level: 5,
    color: 'bg-red-600 text-white',
    description: 'Manage users and customers',
    icon: Shield,
  },
  'client_manager': {
    name: 'Client Manager',
    level: 4,
    color: 'bg-blue-600 text-white',
    description: 'Manage client team',
    icon: User,
  },
  'client_user': {
    name: 'Client User',
    level: 3,
    color: 'bg-green-600 text-white',
    description: 'Standard client access',
    icon: User,
  },
  'tester': {
    name: 'Tester',
    level: 2,
    color: 'bg-yellow-600 text-black',
    description: 'Testing and bug reporting',
    icon: User,
  },
  'viewer': {
    name: 'Viewer',
    level: 1,
    color: 'bg-gray-600 text-white',
    description: 'Read-only access',
    icon: User,
  },
} as const;

interface Customer {
  id: string;
  name: string;
  status: string;
}

export function UserFormDialog({ open, onOpenChange, onSuccess }: UserFormDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  
  // Validation error states
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'viewer' as keyof typeof ROLE_CONFIG,
  });

  // Load customers when dialog opens
  useEffect(() => {
    if (open) {
      loadCustomers();
    } else {
      // Reset form
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'viewer',
      });
      setSelectedCustomers([]);
      // Reset validation errors
      setNameError('');
      setEmailError('');
      setPasswordError('');
    }
  }, [open]);

  const loadCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const response = await apiClient.get<{ customers: Customer[]; count: number }>('/admin/customers');
      
      if (response.success && response.data) {
        setCustomers(response.data.customers || []);
      } else {
        console.error('Failed to load customers:', response.error);
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // SECURITY: Comprehensive validation
    const nameValidation = validateName(formData.name, 'Name');
    const emailValidation = validateEmail(formData.email);
    const passwordValidation = validatePassword(formData.password);
    
    if (!nameValidation.isValid) {
      setNameError(nameValidation.error || '');
      toast.error(nameValidation.error || 'Invalid name');
      return;
    }
    
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || '');
      toast.error(emailValidation.error || 'Invalid email');
      return;
    }

    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || '');
      toast.error(passwordValidation.error || 'Invalid password');
      return;
    }

    setIsCreating(true);
    try {
      const response = await apiClient.post('/admin/users', {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role,
        customers: selectedCustomers,
      });

      if (response.success) {
        toast.success('User created successfully');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('[UserFormDialog] Error:', error);
      toast.error('Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const RoleIcon = ROLE_CONFIG[formData.role]?.icon || User;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            Add a new user to the system with role-based access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* User Information */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User Information
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="name">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, name: value });
                      setNameError('');
                      if (value) {
                        const validation = validateName(value, 'Name');
                        if (!validation.isValid) {
                          setNameError(validation.error || '');
                        }
                      }
                    }}
                    placeholder="John Doe"
                    className={nameError ? 'border-destructive' : ''}
                  />
                  {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, email: value });
                        setEmailError('');
                        if (value) {
                          const validation = validateEmail(value);
                          if (!validation.isValid) {
                            setEmailError(validation.error || '');
                          }
                        }
                      }}
                      placeholder="user@example.com"
                      className={`pl-9 ${emailError ? 'border-destructive' : ''}`}
                    />
                    {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, password: value });
                        setPasswordError('');
                        if (value) {
                          const validation = validatePassword(value);
                          if (!validation.isValid) {
                            setPasswordError(validation.error || '');
                          }
                        }
                      }}
                      placeholder="••••••••"
                      className={`pl-9 ${passwordError ? 'border-destructive' : ''}`}
                    />
                    {passwordError && <p className="text-xs text-destructive mt-1">{passwordError}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min 8 characters, uppercase, lowercase, and number required
                  </p>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-4">
                <h3 className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role & Permissions
                </h3>

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

                {/* Role Description */}
                <Alert>
                  <RoleIcon className="h-4 w-4" />
                  <AlertDescription>
                    <span className="block mb-1">
                      <Badge variant="outline" className={ROLE_CONFIG[formData.role]?.color}>
                        {ROLE_CONFIG[formData.role]?.name}
                      </Badge>
                    </span>
                    {ROLE_CONFIG[formData.role]?.description}
                  </AlertDescription>
                </Alert>
              </div>

              {/* Customer Assignment */}
              {formData.role !== 'superadmin' && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Customer Access
                  </h3>

                  {isLoadingCustomers ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : customers.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        No customers available. Create customers first.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border rounded-lg">
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2 p-4">
                          {customers.map((customer) => (
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
                                  <span>{customer.name}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {customer.status}
                                  </Badge>
                                </div>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {selectedCustomers.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCustomers.length} customer{selectedCustomers.length === 1 ? '' : 's'} selected
                    </p>
                  )}
                </div>
              )}

              {formData.role === 'superadmin' && (
                <Alert>
                  <Crown className="h-4 w-4 text-purple-600" />
                  <AlertDescription>
                    Super Admins automatically have access to ALL customers in the system.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-6 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}