import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Alert, AlertDescription } from "../ui/alert";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  AlertTriangle,
  RefreshCw,
  Globe,
  Mail,
  UserPlus,
  Link as LinkIcon,
  UserCog,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Building,
  Layers,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  adminService,
  Customer,
} from "../../services/adminService";
import { toast } from "sonner@2.0.3";
import { MemberManagementDialog } from "./MemberManagementDialog";
import { TeamAssignmentDialog } from "./TeamAssignmentDialog";
import { CustomerFormDialog } from "./CustomerFormDialog";

const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  inactive: {
    label: "Inactive",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: XCircle,
  },
  staging: {
    label: "Staging",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: AlertCircle,
  },
  production: {
    label: "Production",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: CheckCircle2,
  },
};

const ENVIRONMENT_CONFIG = {
  UAT: {
    label: "UAT",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  Production: {
    label: "Production",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  Staging: {
    label: "Staging",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  Development: {
    label: "Development",
    color: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

export function AdminCustomers() {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog States
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] =
    useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] =
    useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Filters
  const [customerFilter, setCustomerFilter] = useState({
    status: "all",
    environment: "all",
    search: "",
  });

  // Set access token
  useEffect(() => {
    if (session?.access_token) {
      adminService.setAccessToken(session.access_token);
    }
  }, [session?.access_token]);

  // Load customers
  const loadCustomers = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await adminService.getCustomers();

      if (result.success && result.data) {
        const customerList = result.data.customers || [];
        setCustomers(customerList);
      } else {
        console.error(
          "[AdminCustomers] Failed to load customers:",
          result.error,
        );
        setError(result.error || "Failed to load customers");
        setCustomers([]);
      }
    } catch (err) {
      console.error(
        "[AdminCustomers] Error loading customers:",
        err,
      );
      setError("Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, [session?.access_token]);

  const handleDeleteCustomer = async (
    customerId: string,
    customerName: string,
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`,
      )
    )
      return;

    try {
      const result =
        await adminService.deleteCustomer(customerId);

      if (result.success) {
        toast.success("Customer deleted successfully");
        await loadCustomers();
      } else {
        toast.error(
          result.error || "Failed to delete customer",
        );
      }
    } catch (error) {
      console.error(
        "[AdminCustomers] Error deleting customer:",
        error,
      );
      toast.error("Failed to delete customer");
    }
  };

  const handleRefresh = async () => {
    await loadCustomers();
    toast.success("Customers refreshed");
  };

  // 🆕 Handle create customer
  const handleCreateCustomer = async (data: any) => {
    try {
      const result = await adminService.createCustomer(data);

      if (result.success) {
        toast.success("Customer created successfully");
        setCreateDialogOpen(false);
        await loadCustomers();
      } else {
        toast.error(
          result.error || "Failed to create customer",
        );
        throw new Error(
          result.error || "Failed to create customer",
        );
      }
    } catch (error) {
      console.error(
        "[AdminCustomers] Error creating customer:",
        error,
      );
      toast.error("Failed to create customer");
      throw error;
    }
  };

  //Handle edit customer
  const handleEditCustomer = async (data: any) => {
    if (!selectedCustomer) return;

    try {
      console.log(
        "️ [AdminCustomers] Editing customer:",
        selectedCustomer.id,
        data,
      );
      const result = await adminService.updateCustomer(
        selectedCustomer.id,
        data,
      );

      if (result.success) {
        toast.success("Customer updated successfully");
        setEditDialogOpen(false);
        await loadCustomers();
      } else {
        toast.error(
          result.error || "Failed to update customer",
        );
        throw new Error(
          result.error || "Failed to update customer",
        );
      }
    } catch (error) {
      console.error(
        "[AdminCustomers] Error updating customer:",
        error,
      );
      toast.error("Failed to update customer");
      throw error;
    }
  };

  // Get customer initials for avatar
  const getCustomerInitials = (customer: Customer) => {
    const words = customer.name.split(" ");
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return customer.name.substring(0, 2).toUpperCase();
  };

  // Filter customers
  const filteredCustomers = React.useMemo(() => {
    if (!customers || !Array.isArray(customers)) {
      return [];
    }

    return customers.filter((customer) => {
      const matchesStatus =
        customerFilter.status === "all" ||
        customer.status === customerFilter.status;
      const matchesEnvironment =
        customerFilter.environment === "all" ||
        customer.environment === customerFilter.environment;
      const matchesSearch =
        customerFilter.search === "" ||
        customer.name
          .toLowerCase()
          .includes(customerFilter.search.toLowerCase()) ||
        customer.description
          ?.toLowerCase()
          .includes(customerFilter.search.toLowerCase()) ||
        customer.contactEmail
          ?.toLowerCase()
          .includes(customerFilter.search.toLowerCase());

      return (
        matchesStatus && matchesEnvironment && matchesSearch
      );
    });
  }, [
    customers,
    customerFilter.status,
    customerFilter.environment,
    customerFilter.search,
  ]);

  // Stats calculations
  const stats = React.useMemo(
    () => ({
      total: customers?.length || 0,
      active:
        customers?.filter((c) => c.status === "active")
          .length || 0,
      inactive:
        customers?.filter((c) => c.status === "inactive")
          .length || 0,
      //Schema V2.0: Support both camelCase and snake_case
      totalUsers:
        customers?.reduce(
          (sum, c) =>
            sum + ((c.usersCount ?? c.users_count) || 0),
          0,
        ) || 0,
      totalTeams:
        customers?.reduce(
          (sum, c) =>
            sum + ((c.teamsCount ?? c.teams_count) || 0),
          0,
        ) || 0,
    }),
    [customers],
  );

  // Check if any filter is active
  const hasActiveFilters =
    customerFilter.status !== "all" ||
    customerFilter.environment !== "all" ||
    customerFilter.search !== "";

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 dark:bg-red-950/20"
        >
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <div className="font-medium text-red-900 dark:text-red-100">
              Failed to load customers
            </div>
            <div className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error}
            </div>
          </AlertDescription>
        </Alert>
        <Button
          onClick={loadCustomers}
          variant="outline"
          size="lg"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Loading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/*Enhanced Header - Teifi Design System */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Customer Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage client companies, members, and team
                assignments
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="default"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Refresh
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Reload customer list from server
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="default"
            className="gap-2 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">
              Add Customer
            </span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/*Enhanced Stats Cards - Teifi Design System */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Customers */}
        <Card className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Total Customers
                </p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {stats.total}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10 group-hover:scale-110 transition-transform duration-300">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Customers */}
        <Card className="group relative overflow-hidden border-2 hover:border-green-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Active
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-green-600 dark:text-green-400">
                  {stats.active}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center ring-1 ring-green-500/10 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inactive Customers */}
        <Card className="group relative overflow-hidden border-2 hover:border-gray-400/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-400/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Inactive
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-600 dark:text-gray-400">
                  {stats.inactive}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-gray-400/20 to-gray-400/5 flex items-center justify-center ring-1 ring-gray-400/10 group-hover:scale-110 transition-transform duration-300">
                <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card className="group relative overflow-hidden border-2 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Total Users
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-purple-600 dark:text-purple-400">
                  {stats.totalUsers}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center ring-1 ring-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Teams */}
        <Card className="group relative overflow-hidden border-2 hover:border-amber-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Total Teams
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                  {stats.totalTeams}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center ring-1 ring-amber-500/10 group-hover:scale-110 transition-transform duration-300">
                <Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/*Enhanced Filters - Glassmorphism Design */}
      <Card className="border-2 bg-gradient-to-br from-background via-background to-muted/20 backdrop-blur-sm">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">
                Search customers
              </Label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="search"
                  placeholder="Search by name, description, or email..."
                  value={customerFilter.search}
                  onChange={(e) =>
                    setCustomerFilter((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  className="pl-10 h-11 bg-background/50 backdrop-blur-sm border-2 focus:border-primary/50 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2 md:gap-3">
              <div className="min-w-[140px] md:min-w-[160px]">
                <Label
                  htmlFor="status-filter"
                  className="sr-only"
                >
                  Filter by status
                </Label>
                <Select
                  value={customerFilter.status}
                  onValueChange={(value) =>
                    setCustomerFilter((prev) => ({
                      ...prev,
                      status: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="status-filter"
                    className="h-11 bg-background/50 backdrop-blur-sm border-2 focus:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="All Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Status
                    </SelectItem>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        <span>Active</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-gray-600" />
                        <span>Inactive</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="staging">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-blue-600" />
                        <span>Staging</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-purple-600" />
                        <span>Production</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px]">
                <Label htmlFor="env-filter" className="sr-only">
                  Filter by environment
                </Label>
                <Select
                  value={customerFilter.environment}
                  onValueChange={(value) =>
                    setCustomerFilter((prev) => ({
                      ...prev,
                      environment: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="env-filter"
                    className="h-11"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="All Environments" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Environments
                    </SelectItem>
                    <SelectItem value="UAT">UAT</SelectItem>
                    <SelectItem value="Production">
                      Production
                    </SelectItem>
                    <SelectItem value="Staging">
                      Staging
                    </SelectItem>
                    <SelectItem value="Development">
                      Development
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <Badge variant="secondary" className="text-xs">
                {filteredCustomers.length}{" "}
                {filteredCustomers.length === 1
                  ? "result"
                  : "results"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCustomerFilter({
                    status: "all",
                    environment: "all",
                    search: "",
                  })
                }
                className="h-7 text-xs"
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="border-2">
        <CardHeader className="border-b bg-muted/30 px-6 py-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Customers ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-semibold">
                    Customer
                  </TableHead>
                  <TableHead className="font-semibold">
                    Contact
                  </TableHead>
                  <TableHead className="font-semibold">
                    Members
                  </TableHead>
                  <TableHead className="font-semibold">
                    Teams
                  </TableHead>
                  <TableHead className="font-semibold">
                    Environment
                  </TableHead>
                  <TableHead className="font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const statusInfo =
                    STATUS_CONFIG[
                      customer.status as keyof typeof STATUS_CONFIG
                    ] || STATUS_CONFIG.active;
                  const envInfo =
                    ENVIRONMENT_CONFIG[
                      customer.environment as keyof typeof ENVIRONMENT_CONFIG
                    ];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow
                      key={customer.id}
                      className="hover:bg-muted/50 transition-colors border-b"
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-muted">
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-sm">
                              {getCustomerInitials(customer)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {customer.name}
                            </div>
                            {customer.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {customer.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {customer.contactEmail ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {customer.contactEmail}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No contact
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {customer.users_count || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {customer.users_count === 1
                                ? "user"
                                : "users"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">
                              {/*Schema V2.0: Support both camelCase and snake_case */}
                              {(customer.teamsCount ??
                                customer.teams_count) ||
                                0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(customer.teamsCount ??
                                customer.teams_count) === 1
                                ? "team"
                                : "teams"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {envInfo ? (
                          <Badge
                            variant="outline"
                            className={`${envInfo.color} font-medium border`}
                          >
                            {envInfo.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant="outline"
                          className={`${statusInfo.color} font-medium border`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1.5" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCustomer(
                                      customer,
                                    );
                                    setMemberDialogOpen(true);
                                  }}
                                  className="h-9 w-9 p-0"
                                >
                                  <UserCog className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Manage members
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCustomer(
                                      customer,
                                    );
                                    setTeamDialogOpen(true);
                                  }}
                                  className="h-9 w-9 p-0"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Assign teams
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCustomer(
                                      customer,
                                    );
                                    setEditDialogOpen(true);
                                  }}
                                  className="h-9 w-9 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Edit customer
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteCustomer(
                                      customer.id,
                                      customer.name,
                                    )
                                  }
                                  className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-800 dark:hover:bg-red-950"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Delete customer
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Building2 className="h-8 w-8 text-muted-foreground opacity-50" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1">
                          No customers found
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {hasActiveFilters
                            ? "Try adjusting your filters to find what you're looking for"
                            : "Get started by creating your first customer"}
                        </p>
                        {hasActiveFilters ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCustomerFilter({
                                status: "all",
                                environment: "all",
                                search: "",
                              })
                            }
                          >
                            Clear all filters
                          </Button>
                        ) : (
                          <Button
                            onClick={() =>
                              setCreateDialogOpen(true)
                            }
                            size="sm"
                          >
                            <Building className="h-4 w-4 mr-2" />
                            Add Customer
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CustomerFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateCustomer}
        mode="create"
      />

      {selectedCustomer && (
        <>
          <CustomerFormDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onSubmit={handleEditCustomer}
            customer={selectedCustomer}
            mode="edit"
          />

          <MemberManagementDialog
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
            open={memberDialogOpen}
            onOpenChange={setMemberDialogOpen}
            onMembersUpdated={loadCustomers}
          />

          <TeamAssignmentDialog
            customerId={selectedCustomer?.id || ""}
            customerName={selectedCustomer?.name || ""}
            open={teamDialogOpen}
            onOpenChange={setTeamDialogOpen}
            onTeamsUpdated={loadCustomers}
          />
        </>
      )}
    </div>
  );
}