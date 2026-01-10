import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AlertTriangle, Shield, User } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { adminService } from "../../services/adminService";

interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    userId: string;
    email?: string;
    name?: string;
    role: string;
  };
  organizationId: string;
  organizationName: string;
  onSuccess?: () => void;
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  member,
  organizationId,
  organizationName,
  onSuccess
}: DeleteMemberDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmationPhrase = "REMOVE";

  const handleDelete = async () => {
    if (confirmText !== confirmationPhrase) {
      toast.error(`Please type "${confirmationPhrase}" to confirm`);
      return;
    }

    setIsDeleting(true);

    try {
      // Use new synced API that removes from both organization and user permissions
      const result = await adminService.removeMemberFromOrganization({
        organizationId,
        userId: member.userId
      });

      if (result.success) {
        toast.success(`${member.name || member.email} removed from ${organizationName} and user permissions synced`);
        onSuccess?.();
        onOpenChange(false);
        setConfirmText("");
      } else {
        toast.error(result.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Delete member error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove Member from Organization
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action will remove the member's access to this organization.
            This action can be reversed by re-adding the member.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Member Info */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <User className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium">{member.name || member.email}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Role:</span>
              <Badge variant="outline">{member.role}</Badge>
            </div>
          </div>

          {/* Organization Info */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Organization:</strong> {organizationName}
            </AlertDescription>
          </Alert>

          {/* Warning */}
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              <strong>Warning:</strong> The member will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Lose access to all issues in this organization</li>
                <li>No longer receive notifications for this organization</li>
                <li>Be removed from all teams in this organization</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type <strong className="text-destructive">{confirmationPhrase}</strong> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmationPhrase}
              className={confirmText && confirmText !== confirmationPhrase ? 'border-destructive' : ''}
              autoComplete="off"
            />
          </div>

          {/* Audit Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Audit Trail:</strong> This action will be logged and the member will be notified via email.
            </AlertDescription>
          </Alert>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={() => setConfirmText("")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== confirmationPhrase}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? 'Removing...' : 'Remove Member'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
