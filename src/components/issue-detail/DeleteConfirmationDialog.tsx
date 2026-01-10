import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeleteConfirmationDialogProps {
  open: boolean;
  identifier: string;
  title: string;
  isParent: boolean;
  childrenCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationDialog({
  open,
  identifier,
  title,
  isParent,
  childrenCount,
  isDeleting,
  onConfirm,
  onCancel
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent 
        className="!max-w-[30vh] min-w-[320px]"
        showClose={true}
        onClose={onCancel}
      >
        <AlertDialogHeader className="pb-2">
          <div className="flex items-start gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 flex-shrink-0">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-sm">
                Delete {isParent ? 'Group Task' : 'Issue'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-2">
          {/* Issue info */}
          <div className="flex items-start gap-1.5 p-2 bg-muted/30 rounded border border-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <Badge variant="outline" className="font-mono text-[10px] h-4 px-1.5">
                  {identifier}
                </Badge>
                {isParent && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    Group
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground truncate">
                {title}
              </p>
            </div>
          </div>

          {/* Warning for parent issues with children */}
          {isParent && childrenCount > 0 && (
            <div className="flex items-start gap-1.5 p-2 bg-destructive/10 rounded border border-destructive/30">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-destructive mb-0.5">
                  Cascade Delete
                </p>
                <p className="text-xs text-muted-foreground">
                  Will also delete <span className="font-semibold text-foreground">{childrenCount} sub-issue{childrenCount > 1 ? 's' : ''}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Standard warning */}
          {(!isParent || childrenCount === 0) && (
            <div className="flex items-start gap-1.5 p-2 bg-muted/30 rounded border border-border">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter className="pt-2">
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting} className="h-8 text-xs px-3">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs px-3"
          >
            {isDeleting ? (
              <>
                <div className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3 w-3" />
                Delete {isParent && childrenCount > 0 ? `(+${childrenCount})` : ''}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}