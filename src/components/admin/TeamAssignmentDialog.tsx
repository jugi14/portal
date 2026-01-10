import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Link as LinkIcon,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Users,
  Info,
  UserPlus,
  UserMinus,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { adminService } from "../../services/adminService";
import { linearTeamService } from "../../services/linearTeamService";
import { teamServiceV2 } from "../../services/teamServiceV2";
import { apiClient } from "../../services/apiClient";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";

interface TeamAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onTeamsUpdated: () => void;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface AssignedTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  state?: string;
  color?: string;
  icon?: string;
  parentId?: string; // Schema V2.0: camelCase
  parentName?: string; // Schema V2.0: camelCase
  parentKey?: string; // Schema V2.0: camelCase
}

interface TeamMember {
  userId: string; // Schema V2.0: camelCase
  email: string;
  name: string;
  role: string;
}

export function TeamAssignmentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onTeamsUpdated,
}: TeamAssignmentDialogProps) {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignedTeams, setAssignedTeams] = useState<
    AssignedTeam[]
  >([]);
  const [availableTeams, setAvailableTeams] = useState<
    LinearTeam[]
  >([]);
  const [selectedTeamId, setSelectedTeamId] =
    useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // Track teams with customer assignments (for exclusivity check)
  const [teamsWithCustomers, setTeamsWithCustomers] = useState<Map<string, { customerId: string; customerName: string }>>(new Map());

  // Team-Level Access Control
  const [selectedTeamForMembers, setSelectedTeamForMembers] =
    useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
    [],
  );
  const [customerMembers, setCustomerMembers] = useState<any[]>(
    [],
  );
  const [loadingTeamMembers, setLoadingTeamMembers] =
    useState(false);

  // PERFORMANCE: Prevent duplicate API calls
  const isLoadingRef = React.useRef(false);
  const loadedCustomerRef = React.useRef<string | null>(null);

  // Load data function (memoized to prevent useEffect dependency issues)
  const loadData = React.useCallback(async () => {
    // CRITICAL: Prevent duplicate calls if already loading
    if (isLoadingRef.current) {
      console.log('[TeamAssignment] Already loading, skipping duplicate call');
      return;
    }
    
    // PERFORMANCE: Skip if data already loaded for this customer
    if (loadedCustomerRef.current === customerId && assignedTeams.length > 0) {
      console.log('[TeamAssignment] Data already loaded for customer, skipping');
      return;
    }
    
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log(`[TeamAssignment] Loading data for customer: ${customerId}`);
      
      // PERFORMANCE: Load assigned teams first (critical for UI)
      // Then load available teams + members in parallel (non-blocking)
      
      // 1. Load assigned teams IMMEDIATELY (don't wait for others)
      const assignedTeamsPromise = adminService.getCustomerTeams(customerId)
        .then(teams => {
          setAssignedTeams(teams || []);
          // PERFORMANCE: Set loading=false as soon as we have assigned teams
          // This allows UI to render immediately while other data loads
          setLoading(false);
          return teams;
        })
        .catch(err => {
          console.error('[TeamAssignment] Failed to load assigned teams:', err);
          setAssignedTeams([]);
          setLoading(false);
          return [];
        });
      
      // 2. Load available teams + members in parallel (background)
      const [availableTeamsResponse, membersResult] = await Promise.allSettled([
        apiClient.get(`/admin/customers/${customerId}/available-teams`),
        adminService.getCustomerMembers(customerId),
      ]);

      // Process available teams
      if (availableTeamsResponse.status === 'fulfilled') {
        const response = availableTeamsResponse.value;
        if (response.success && response.data?.teams && Array.isArray(response.data.teams)) {
          const formattedTeams: LinearTeam[] = response.data.teams.map((team: any) => ({
            id: team.id,
            name: team.name,
            key: team.key || team.id,
          }));
          setAvailableTeams(formattedTeams);
        } else {
          setAvailableTeams([]);
          setError(
            "No teams available for assignment. All teams may be assigned to other customers.",
          );
        }
      } else {
        console.error('[TeamAssignment] Failed to load available teams:', availableTeamsResponse.reason);
        setAvailableTeams([]);
        setError("Failed to load available teams. Please try again.");
      }

      // Process customer members (non-blocking - show modal even if this fails)
      if (membersResult.status === 'fulfilled') {
        if (membersResult.value.success && membersResult.value.members) {
          setCustomerMembers(membersResult.value.members);
        } else {
          console.warn('[TeamAssignment] No customer members data available');
          setCustomerMembers([]);
        }
      } else {
        // Members loading failed - not critical, modal can still work
        console.warn('[TeamAssignment] Failed to load customer members (non-critical):', membersResult.reason);
        setCustomerMembers([]);
      }
      
      // Wait for assigned teams to finish
      await assignedTeamsPromise;
      
      // Mark as loaded for this customer
      loadedCustomerRef.current = customerId;
      
    } catch (err) {
      console.error(
        "[TeamAssignment] Error loading team data:",
        err,
      );
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load team data",
      );
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, [customerId]); // Only re-create if customerId changes

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      // Validate customerId before loading
      if (!customerId || customerId.trim() === "") {
        console.error(
          "[TeamAssignment] Invalid customerId:",
          customerId,
        );
        setError(
          "Invalid customer ID. Please close and try again.",
        );
        setLoading(false);
        return;
      }
      loadData();
    } else {
      // CLEANUP: Reset state when dialog closes
      loadedCustomerRef.current = null;
      setAssignedTeams([]);
      setAvailableTeams([]);
      setCustomerMembers([]);
      setSelectedTeamId("");
      setError(null);
    }
  }, [open, customerId, loadData]);

  const handleAssignTeam = async () => {
    console.log("[TeamAssignment] handleAssignTeam called:", {
      selectedTeamId,
      selectedTeamIdType: typeof selectedTeamId,
      availableTeamsCount: availableTeams.length,
    });

    if (!selectedTeamId) {
      console.error("[TeamAssignment] No team selected");
      toast.error("Please select a team");
      return;
    }

    const team = availableTeams.find(
      (t) => t.id === selectedTeamId,
    );
    console.log("[TeamAssignment] Found team:", {
      team,
      teamId: team?.id,
      teamName: team?.name,
    });

    if (!team) {
      console.error(
        "[TeamAssignment] Team not found in availableTeams",
      );
      toast.error("Team not found");
      return;
    }

    if (!team.id || team.id.trim() === "") {
      console.error(
        "[TeamAssignment] Team has invalid ID:",
        team,
      );
      toast.error("Selected team has invalid ID");
      return;
    }

    console.log("[TeamAssignment] Assigning team:", {
      customerId,
      linearTeamId: team.id,
      linearTeamName: team.name,
    });

    setAssigning(true);
    try {
      // Step 1: Assign team
      await adminService.assignTeamToCustomer(customerId, {
        linearTeamId: team.id,
        linearTeamName: team.name,
      });

      toast.success(
        `Team "${team.name}" assigned successfully`,
      );
      
      // Step 2: Reload data (keep assigning state true)
      setSelectedTeamId("");
      await loadData();
      onTeamsUpdated();
    } catch (err) {
      console.error("Error assigning team:", err);
      toast.error("Failed to assign team");
    } finally {
      // Only reset assigning after everything is done
      setAssigning(false);
    }
  };

  const handleRemoveTeam = async (
    teamId: string,
    teamName: string,
  ) => {
    if (
      !confirm(
        `Remove team "${teamName}"? This will remove all team-level member assignments.`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await adminService.removeTeamFromCustomer(
        customerId,
        teamId,
      );
      toast.success(`Team "${teamName}" removed successfully`);
      await loadData();
      onTeamsUpdated();
    } catch (err) {
      console.error("Error removing team:", err);
      toast.error("Failed to remove team");
    } finally {
      setLoading(false);
    }
  };

  // Team-Level Member Management
  const loadTeamMembers = async (teamId: string) => {
    setLoadingTeamMembers(true);
    try {
      console.log(
        `[TeamAssignment] Loading members for team ${teamId}`,
      );
      const result = await adminService.getTeamMembers(
        customerId,
        teamId,
      );
      if (result.success && result.data) {
        console.log(
          `[TeamAssignment] Loaded ${result.data.members?.length || 0} team members`,
        );
        setTeamMembers(result.data.members || []);
      }
    } catch (err) {
      console.error("Error loading team members:", err);
      toast.error("Failed to load team members");
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handleAddMemberToTeam = async (
    userId: string,
    teamId: string,
  ) => {
    setLoadingTeamMembers(true);
    try {
      const result = await adminService.addMemberToTeam(
        customerId,
        teamId,
        userId,
      );
      if (result.success) {
        toast.success("Member added to team");
        await loadTeamMembers(teamId);
      } else {
        toast.error(result.error || "Failed to add member");
      }
    } catch (err) {
      console.error("Error adding member to team:", err);
      toast.error("Failed to add member to team");
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handleRemoveMemberFromTeam = async (
    userId: string,
    teamId: string,
  ) => {
    if (!confirm("Remove this member's access to this team?")) {
      return;
    }

    setLoadingTeamMembers(true);
    try {
      const result = await adminService.removeMemberFromTeam(
        customerId,
        teamId,
        userId,
      );
      if (result.success) {
        toast.success("Member removed from team");
        await loadTeamMembers(teamId);
      } else {
        toast.error(result.error || "Failed to remove member");
      }
    } catch (err) {
      console.error("Error removing member from team:", err);
      toast.error("Failed to remove member from team");
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const toggleTeamMemberView = (teamId: string) => {
    if (selectedTeamForMembers === teamId) {
      setSelectedTeamForMembers(null);
      setTeamMembers([]);
    } else {
      setSelectedTeamForMembers(teamId);
      loadTeamMembers(teamId);
    }
  };

  // SIMPLIFIED: availableTeams already filtered by backend - only teams NOT assigned to other customers
  // Just use availableTeams directly as unassignedTeams
  const unassignedTeams = availableTeams;

  // PERFORMANCE: Team state filtered

  // Get members not in team
  const getAvailableMembersForTeam = () => {
    const teamMemberIds = teamMembers.map((tm) => tm.userId);
    return customerMembers.filter(
      (cm) => !teamMemberIds.includes(cm.userId),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            Manage Teams
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {customerName}
            </span>
            <span className="text-muted-foreground">•</span>
            <span>
              Assign Linear teams and configure team-level
              access
            </span>
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadData}
                className="h-7"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Assign New Team Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Assign Team</h3>
              </div>

              <Card className="border-2 border-dashed">
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Select
                            value={selectedTeamId}
                            onValueChange={(value) => {
                              console.log(
                                "[TeamAssignment] Select onChange:",
                                {
                                  value,
                                  valueType: typeof value,
                                  valueLength: value?.length,
                                },
                              );
                              setSelectedTeamId(value);
                            }}
                            disabled={
                              assigning ||
                              loading ||
                              unassignedTeams.length === 0
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a Linear team to assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedTeams.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  {availableTeams.length === 0
                                    ? "No teams available. Please sync from Linear first."
                                    : "All available teams are already assigned."}
                                </div>
                              ) : (
                                unassignedTeams.map((team) => (
                                  <SelectItem
                                    key={team.id}
                                    value={team.id}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-xs"
                                      >
                                        {team.key}
                                      </Badge>
                                      <span>{team.name}</span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAssignTeam}
                          disabled={
                            !selectedTeamId || assigning || loading
                          }
                          className="min-w-[140px]"
                        >
                          {assigning ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {loading ? 'Refreshing...' : 'Assigning...'}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Assign Team
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Debug Info */}
                      {process.env.NODE_ENV ===
                        "development" && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                          <div>
                            Available: {availableTeams.length}{" "}
                            teams
                          </div>
                          <div>
                            Assigned: {assignedTeams.length}{" "}
                            teams
                          </div>
                          <div>
                            Unassigned: {unassignedTeams.length}{" "}
                            teams
                          </div>
                          <div>
                            Selected ID:{" "}
                            {selectedTeamId || "none"}
                          </div>
                          {selectedTeamId && (
                            <div>
                              Selected Team:{" "}
                              {availableTeams.find(
                                (t) => t.id === selectedTeamId,
                              )?.name || "not found"}
                            </div>
                          )}
                        </div>
                      )}

                      {unassignedTeams.length === 0 &&
                        availableTeams.length > 0 && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>
                              All available teams are assigned
                            </span>
                          </div>
                        )}

                      {availableTeams.length === 0 &&
                        !loading && (
                          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="font-medium">
                                  No Linear teams available in
                                  cache
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-500">
                                  Teams will be loaded
                                  automatically when you visit
                                  the Teams page. Please visit
                                  the Teams page first, then
                                  return here to assign teams.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Assigned Teams List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">
                    Assigned Teams
                    {!loading && (
                      <Badge
                        variant="secondary"
                        className="ml-2"
                      >
                        {assignedTeams.length}
                      </Badge>
                    )}
                    {loading && (
                      <Badge
                        variant="outline"
                        className="ml-2"
                      >
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Updating...
                      </Badge>
                    )}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadData}
                  disabled={loading || assigning}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Skeleton className="h-4 w-4" />
                              <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-3 w-32" />
                              </div>
                            </div>
                            <Skeleton className="h-9 w-32" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : assignedTeams.length === 0 ? (
                <Card className="border-2 border-dashed">
                  <CardContent className="py-12">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <LinkIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium">
                          No teams assigned yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Get started by assigning a Linear team
                          above
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {assignedTeams.map((team) => (
                    <Card
                      key={team.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          {/* Team Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <LinkIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {team.name ||
                                    team.id ||
                                    "Unknown Team"}
                                  {team.key && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs font-mono"
                                    >
                                      {team.key}
                                    </Badge>
                                  )}
                                  {team.parentName && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Parent: {team.parentName}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {team.description ||
                                    (team.state
                                      ? `Status: ${team.state}`
                                      : "Linear team")}
                                  {team.id &&
                                    ` • Team ID: ${team.id.substring(0, 8)}...`}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  toggleTeamMemberView(team.id)
                                }
                                disabled={loading || assigning}
                              >
                                <Users className="h-3 w-3 mr-1" />
                                {selectedTeamForMembers ===
                                team.id
                                  ? "Hide Members"
                                  : "Manage Members"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveTeam(
                                    team.id,
                                    team.name,
                                  )
                                }
                                disabled={loading || assigning}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Team-Level Member Management (Collapsible) */}
                          {selectedTeamForMembers ===
                            team.id && (
                            <div className="mt-4 pt-4 border-t space-y-4">
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                  <span className="font-medium">
                                    Team-level access control:
                                  </span>{" "}
                                  Only selected members can view
                                  this team's issues in the
                                  dashboard
                                </AlertDescription>
                              </Alert>

                              {loadingTeamMembers ? (
                                <div className="space-y-3">
                                  <Skeleton className="h-10 w-full" />
                                  <Skeleton className="h-24 w-full" />
                                </div>
                              ) : (
                                <>
                                  {/* Add Member to Team */}
                                  <div className="flex gap-2">
                                    <Select
                                      onValueChange={(
                                        userId,
                                      ) => {
                                        handleAddMemberToTeam(
                                          userId,
                                          team.id,
                                        );
                                      }}
                                      disabled={
                                        getAvailableMembersForTeam()
                                          .length === 0
                                      }
                                    >
                                      <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Add member to team..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getAvailableMembersForTeam().map(
                                          (member) => (
                                            <SelectItem
                                              key={
                                                member.userId
                                              }
                                              value={
                                                member.userId
                                              }
                                            >
                                              <div className="flex items-center gap-2">
                                                <span>
                                                  {member.name ||
                                                    member.email}
                                                </span>
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs"
                                                >
                                                  {member.role}
                                                </Badge>
                                              </div>
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Current Team Members */}
                                  {teamMembers.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>
                                              Member
                                            </TableHead>
                                            <TableHead>
                                              Role
                                            </TableHead>
                                            <TableHead className="w-[100px]">
                                              Actions
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {teamMembers.map(
                                            (member) => (
                                              <TableRow
                                                key={
                                                  member.userId
                                                }
                                              >
                                                <TableCell>
                                                  <div>
                                                    <div className="font-medium">
                                                      {
                                                        member.name
                                                      }
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                      {
                                                        member.email
                                                      }
                                                    </div>
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">
                                                    {
                                                      member.role
                                                    }
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      handleRemoveMemberFromTeam(
                                                        member.userId,
                                                        team.id,
                                                      )
                                                    }
                                                  >
                                                    <UserMinus className="h-4 w-4 text-destructive" />
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            ),
                                          )}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <Card className="border-dashed">
                                      <CardContent className="py-6">
                                        <p className="text-sm text-muted-foreground text-center">
                                          No members assigned to
                                          this team yet
                                        </p>
                                      </CardContent>
                                    </Card>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}