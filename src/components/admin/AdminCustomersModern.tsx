import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Skeleton } from "../ui/skeleton";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Link as LinkIcon,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  BarChart3,
  Calendar,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../services/apiClient";
import { toast } from "sonner@2.0.3";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { MemberManagementDialog } from "./MemberManagementDialog";
import { TeamAssignmentDialog } from "./TeamAssignmentDialog";

//STATUS CONFIGURATION
const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    icon: CheckCircle2,
  },
  inactive: {
    label: "Inactive",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    dotColor: "bg-gray-400",
    icon: XCircle,
  },
  staging: {
    label: "Staging",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
    icon: AlertCircle,
  },
  production: {
    label: "Production",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dotColor: "bg-purple-500",
    icon: CheckCircle2,
  },
} as const;

const ENVIRONMENT_CONFIG = {
  UAT: {
    label: "UAT",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Activity,
  },
  Production: {
    label: "Production",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: CheckCircle2,
  },
  Staging: {
    label: "Staging",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: AlertCircle,
  },
  Development: {
    label: "Development",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Activity,
  },
} as const;

interface Customer {
  id: string;
  name: string;
  status: keyof typeof STATUS_CONFIG;
  environment?: keyof typeof ENVIRONMENT_CONFIG;
  usersCount?: number; //Schema V2.0: camelCase
  teamsCount?: number; //Schema V2.0: camelCase
  createdAt: string; //Schema V2.0: camelCase
  updatedAt?: string; //Schema V2.0: camelCase
  metadata?: {
    domain?: string;
    contactEmail?: string; //Schema V2.0: camelCase
  };
}

export function AdminCustomersModern() {
  const { session } = useAuth();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] =
    useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] =
    useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [environmentFilter, setEnvironmentFilter] =
    useState<string>("all");

  // Set access token
  useEffect(() => {
    if (session?.access_token) {
      apiClient.setAccessToken(session.access_token);
    }
  }, [session?.access_token]);

  // Load customers
  const loadCustomers = async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{
        customers: Customer[];
        count: number;
      }>("/admin/customers");

      if (response.success && response.data) {
        const customerList = response.data.customers || [];
        setCustomers(customerList);
      } else {
        const errorMsg =
          response.error || "Failed to load customers";
        console.error(
          "[AdminCustomers] Load failed:",
          errorMsg,
        );
        setError(errorMsg);
        setCustomers([]);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Failed to load customers";
      console.error("[AdminCustomers] Exception:", err);
      setError(errorMsg);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [session?.access_token]);

  // Delete customer
  const handleDeleteCustomer = async (
    customerId: string,
    customerName: string,
  ) => {
    if (
      !confirm(
        `Delete customer "${customerName}"? This action cannot be undone.`,
      )
    )
      return;

    try {

      const response = await apiClient.delete(
        `/admin/customers/${customerId}`,
      );

      if (response.success) {
        toast.success("Customer deleted successfully");
        await loadCustomers();
      } else {
        toast.error(
          response.error || "Failed to delete customer",
        );
      }
    } catch (error) {
      console.error("[AdminCustomers] Delete error:", error);
      toast.error("Failed to delete customer");
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        !searchQuery ||
        customer.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        customer.metadata?.domain
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        customer.status === statusFilter;
      const matchesEnv =
        environmentFilter === "all" ||
        customer.environment === environmentFilter;

      return matchesSearch && matchesStatus && matchesEnv;
    });
  }, [customers, searchQuery, statusFilter, environmentFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(
      (c) => c.status === "active",
    ).length;
    const totalMembers = customers.reduce(
      (sum, c) => sum + (c.usersCount || 0),
      0,
    );
    const totalTeams = customers.reduce(
      (sum, c) => sum + (c.teamsCount || 0),
      0,
    );

    return { total, active, totalMembers, totalTeams };
  }, [customers]);

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
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
            <p className="font-medium">
              Failed to load customers
            </p>
            <p className="text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCustomers}
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

  const StatusIcon = (status: keyof typeof STATUS_CONFIG) => {
    const Icon = STATUS_CONFIG[status]?.icon || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Customer Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredCustomers.length}{" "}
            {filteredCustomers.length === 1
              ? "customer"
              : "customers"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCustomers}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Active Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {stats.total > 0
                ? Math.round((stats.active / stats.total) * 100)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active} of {stats.total}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              Total Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalTeams}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Team assignments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or domain..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Status
                  </SelectItem>
                  {Object.entries(STATUS_CONFIG).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={environmentFilter}
                onValueChange={setEnvironmentFilter}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Environments
                  </SelectItem>
                  {Object.entries(ENVIRONMENT_CONFIG).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Customers ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ||
                statusFilter !== "all" ||
                environmentFilter !== "all"
                  ? "No customers match your filters"
                  : "No customers found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const statusConfig =
                      STATUS_CONFIG[customer.status] ||
                      STATUS_CONFIG.inactive;
                    const envConfig = customer.environment
                      ? ENVIRONMENT_CONFIG[customer.environment]
                      : null;

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {customer.name}
                                </div>
                                {customer.metadata?.domain && (
                                  <div className="text-xs text-muted-foreground">
                                    {customer.metadata.domain}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusConfig.color}
                          >
                            {StatusIcon(customer.status)}
                            <span className="ml-1">
                              {statusConfig.label}
                            </span>
                          </Badge>
                        </TableCell>

                        <TableCell>
                          {envConfig ? (
                            <Badge
                              variant="outline"
                              className={envConfig.color}
                            >
                              <envConfig.icon className="h-3 w-3 mr-1" />
                              {envConfig.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setMemberDialogOpen(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Users className="h-4 w-4" />
                            {customer.usersCount || 0}
                          </Button>
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setTeamDialogOpen(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <LinkIcon className="h-4 w-4" />
                            {customer.teamsCount || 0}
                          </Button>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(customer.createdAt)}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteCustomer(
                                  customer.id,
                                  customer.name,
                                )
                              }
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CustomerFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={loadCustomers}
      />

      {selectedCustomer && (
        <>
          <CustomerFormDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            customer={selectedCustomer}
            onSuccess={loadCustomers}
          />

          <MemberManagementDialog
            open={memberDialogOpen}
            onOpenChange={setMemberDialogOpen}
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
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