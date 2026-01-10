/**
 * SUPERADMIN MANAGEMENT COMPONENT - Schema v2.0
 * 
 * REFACTORED: Full UI for managing dynamic superadmins
 * - No hardcoded emails displayed
 * - Real-time updates
 * - Audit trail viewer
 * - Professional Teifi design
 * 
 * CRITICAL: NO EMOJIS in code per Guidelines.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { 
  UserPlus, 
  UserMinus, 
  Shield, 
  ShieldCheck, 
  AlertTriangle,
  Loader2,
  Check,
  X,
  RefreshCw,
  History,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { usePermissions } from '../../contexts/PermissionContext';
import {
  getSuperAdminEmails,
  addSuperAdmin,
  removeSuperAdmin,
  getSuperadminAuditTrail,
  initializeSuperadmins,
} from '../../services/superadminService';

interface AuditEntry {
  timestamp: string;
  action: 'added' | 'removed';
  email: string;
  performedBy: string;
}

export function SuperadminManagement() {
  const { userRole, refreshPermissions } = usePermissions();
  const [superadmins, setSuperadmins] = useState<string[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  
  // Initialization state
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initEmails, setInitEmails] = useState<string[]>([]);

  // Load superadmin list
  const loadSuperadmins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const emails = await getSuperAdminEmails();
      setSuperadmins(emails);
      
      // Check if initialization is needed
      if (!emails || emails.length === 0) {
        setNeedsInitialization(true);
      } else {
        setNeedsInitialization(false);
      }
    } catch (err) {
      console.error('[SuperadminManagement] Error loading superadmins:', err);
      
      // If 403 error, likely needs initialization
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('403') || errorMsg.includes('Superadmin access required')) {
        setNeedsInitialization(true);
        setError('No superadmins configured. Please initialize below.');
      } else {
        setError('Failed to load superadmin list');
        toast.error('Failed to load superadmin list');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load audit trail
  const loadAuditTrail = useCallback(async () => {
    try {
      const trail = await getSuperadminAuditTrail();
      setAuditTrail(trail);
    } catch (err) {
      console.error('[SuperadminManagement] Error loading audit trail:', err);
    }
  }, []);

  useEffect(() => {
    loadSuperadmins();
    if (showAudit) {
      loadAuditTrail();
    }
  }, [loadSuperadmins, loadAuditTrail, showAudit]);

  // Refresh all data and permissions
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSuperadmins();
    if (showAudit) {
      await loadAuditTrail();
    }
    await refreshPermissions();
    setRefreshing(false);
    toast.success('Refreshed superadmin data');
  };

  // Initialize superadmins (one-time setup)
  const handleInitialize = async () => {
    const validEmails = initEmails
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@') && e.includes('.'));
    
    if (validEmails.length === 0) {
      toast.error('Please add at least one valid email address');
      return;
    }

    try {
      setInitializing(true);
      setError(null);

      const result = await initializeSuperadmins(validEmails);

      if (result.success) {
        toast.success(`Initialized with ${validEmails.length} superadmins! Refreshing page...`);
        
        // Reload page to refresh all permissions and clear caches
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error || 'Failed to initialize superadmins');
        toast.error(result.error || 'Failed to initialize superadmins');
        setInitializing(false);
      }
    } catch (err) {
      console.error('[SuperadminManagement] Error initializing:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast.error(`Failed to initialize: ${errorMsg}`);
      setInitializing(false);
    }
  };
  
  // Add new superadmin
  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check if already exists
    if (superadmins.some(sa => sa.toLowerCase() === email)) {
      toast.error('This email is already a superadmin');
      return;
    }

    try {
      setAdding(true);
      setError(null);

      const result = await addSuperAdmin(email);

      if (result.success) {
        toast.success(`Added ${email} as superadmin`);
        setNewEmail('');
        await loadSuperadmins();
        await refreshPermissions();
        if (showAudit) {
          await loadAuditTrail();
        }
      } else {
        setError(result.error || 'Failed to add superadmin');
        toast.error(result.error || 'Failed to add superadmin');
      }
    } catch (err) {
      console.error('[SuperadminManagement] Error adding superadmin:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast.error(`Failed to add superadmin: ${errorMsg}`);
    } finally {
      setAdding(false);
    }
  };

  // Remove superadmin
  const handleRemove = async (email: string) => {
    // Safety check - prevent removing yourself
    if (email.toLowerCase() === userRole?.email?.toLowerCase()) {
      toast.error('You cannot remove yourself from superadmin list');
      return;
    }

    try {
      setRemoving(email);
      setError(null);

      const result = await removeSuperAdmin(email);

      if (result.success) {
        toast.success(`Removed ${email} from superadmin list`);
        await loadSuperadmins();
        await refreshPermissions();
        if (showAudit) {
          await loadAuditTrail();
        }
      } else {
        setError(result.error || 'Failed to remove superadmin');
        toast.error(result.error || 'Failed to remove superadmin');
      }
    } catch (err) {
      console.error('[SuperadminManagement] Error removing superadmin:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast.error(`Failed to remove superadmin: ${errorMsg}`);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle>Superadmin Management</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAudit(!showAudit)}
              >
                <History className="h-4 w-4 mr-2" />
                {showAudit ? 'Hide' : 'Show'} Audit Trail
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            Manage superadmin access dynamically. Changes are stored in KV store with full audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Initialization UI - Only shows when KV store is empty */}
          {needsInitialization && (
            <Alert className="border-primary bg-primary/5">
              <Rocket className="h-5 w-5 text-primary" />
              <div className="ml-3 flex-1">
                <h4 className="font-semibold mb-2">Initialize Superadmin List</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  The superadmin list is empty. Initialize with default superadmins to get started.
                  This is a one-time setup.
                </p>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Initial Superadmin Emails:</label>
                    {initEmails.map((email, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            const newEmails = [...initEmails];
                            newEmails[index] = e.target.value;
                            setInitEmails(newEmails);
                          }}
                          placeholder="email@teifi.com"
                          disabled={initializing}
                        />
                        {initEmails.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setInitEmails(initEmails.filter((_, i) => i !== index));
                            }}
                            disabled={initializing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInitEmails([...initEmails, ''])}
                      disabled={initializing}
                    >
                      <UserPlus className="h-3 w-3 mr-2" />
                      Add Another Email
                    </Button>
                  </div>
                  
                  <Button
                    onClick={handleInitialize}
                    disabled={initializing}
                    className="w-full"
                  >
                    {initializing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Initialize Superadmin List
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Alert>
          )}
          
          {/* Add New Superadmin - Only show if initialized */}
          {!needsInitialization && (
            <div className="space-y-3">
              <h3 className="text-sm">Add New Superadmin</h3>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
                disabled={adding}
              />
              <Button
                onClick={handleAdd}
                disabled={adding || !newEmail.trim()}
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Superadmins have full access to all features and can manage other superadmins.
            </p>
            </div>
          )}

          {!needsInitialization && <Separator />}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Current Superadmins */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-sm">Current Superadmins</h3>
                  <Badge variant="outline" className="gap-1">
                    {superadmins.length}
                  </Badge>
                </div>
                {superadmins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserMinus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No superadmins found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] rounded-md border">
                    <div className="space-y-2 p-4">
                      {superadmins.map((email) => {
                        const isCurrentUser = email.toLowerCase() === userRole?.email?.toLowerCase();
                        return (
                          <div
                            key={email}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isCurrentUser 
                                ? 'bg-primary/5 border-primary/20' 
                                : 'hover:bg-accent/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="h-4 w-4 text-primary" />
                              <span className="text-sm font-mono">{email}</span>
                              {isCurrentUser && (
                                <Badge variant="secondary">You</Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemove(email)}
                              disabled={removing === email || isCurrentUser}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              {removing === email ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Removing...
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-1" />
                                  Remove
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}

          {/* Summary */}
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Superadmins</span>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {superadmins.length}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      {showAudit && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent" />
              <CardTitle className="text-sm">Audit Trail</CardTitle>
            </div>
            <CardDescription>
              Complete history of superadmin changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditTrail.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No audit entries found</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {auditTrail.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                    >
                      <div className={`p-1.5 rounded ${
                        entry.action === 'added' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {entry.action === 'added' ? (
                          <UserPlus className="h-3 w-3" />
                        ) : (
                          <UserMinus className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{entry.email}</span>
                          <Badge variant={entry.action === 'added' ? 'default' : 'destructive'} className="text-xs">
                            {entry.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          by {entry.performedBy} • {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm">About Superadmin Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>All superadmins are stored dynamically in KV store</p>
          </div>
          <div className="flex gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>Changes are audited with full timestamp and actor tracking</p>
          </div>
          <div className="flex gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>Only existing superadmins can access this management panel</p>
          </div>
          <div className="flex gap-2">
            <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p>Changes take effect immediately with 5-minute cache</p>
          </div>
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p>You cannot remove yourself from the superadmin list</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
