/**
 * 🏢 Customer Form Dialog - Schema v2.0 Compliant
 * 
 * Fixed version with proper Dialog structure and API V2 integration
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Building2, Loader2, Save, X } from "lucide-react";
import { apiClient } from "../../services/apiClient";
import { toast } from "sonner@2.0.3";

interface Customer {
  id: string;
  name: string;
  status: string;
  description?: string;
  contactEmail?: string;
  google_domain?: string;
  epic?: string;
  project?: string;
  environment?: string;
  metadata?: any;
}

interface CustomerFormData {
  name: string;
  description: string;
  contactEmail: string;
  google_domain: string;
  epic: string;
  project: string;
  environment: string;
  status: string;
}

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSuccess?: () => void;
}

const initialFormData: CustomerFormData = {
  name: "",
  description: "",
  contactEmail: "",
  google_domain: "",
  epic: "",
  project: "",
  environment: "UAT",
  status: "active",
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!customer;

  // Load customer data when editing
  useEffect(() => {
    if (customer && open) {
      setFormData({
        name: customer.name || "",
        description: customer.description || "",
        contactEmail: customer.contactEmail || customer.metadata?.contact_email || "",
        google_domain: customer.google_domain || customer.metadata?.domain || "",
        epic: customer.epic || "",
        project: customer.project || "",
        environment: customer.environment || "UAT",
        status: customer.status || "active",
      });
    } else if (!customer && open) {
      setFormData(initialFormData);
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && customer) {
        // Update existing customer
        const response = await apiClient.put(`/admin/customers/${customer.id}`, {
          name: formData.name,
          description: formData.description || undefined,
          contactEmail: formData.contactEmail || undefined,
          google_domain: formData.google_domain || undefined,
          epic: formData.epic || undefined,
          project: formData.project || undefined,
          environment: formData.environment,
          status: formData.status,
        });

        if (response.success) {
          toast.success("Customer updated successfully");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(response.error || "Failed to update customer");
        }
      } else {
        // Create new customer
        const response = await apiClient.post('/admin/customers', {
          name: formData.name,
          description: formData.description || undefined,
          contactEmail: formData.contactEmail || undefined,
          google_domain: formData.google_domain || undefined,
          epic: formData.epic || undefined,
          project: formData.project || undefined,
          environment: formData.environment,
          status: formData.status,
        });

        if (response.success) {
          toast.success("Customer created successfully");
          setFormData(initialFormData); // Reset form
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(response.error || "Failed to create customer");
        }
      }
    } catch (error) {
      console.error('[CustomerForm] Error:', error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {isEditMode ? "Edit Customer" : "Create New Customer"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isEditMode
                  ? "Update customer information"
                  : "Add a new customer to the system"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="px-6 py-4 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">
                    Customer Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    required
                    disabled={isSubmitting}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Brief description of the customer..."
                    disabled={isSubmitting}
                    rows={3}
                    className="mt-1.5 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleChange("contactEmail", e.target.value)}
                      placeholder="contact@example.com"
                      disabled={isSubmitting}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="google_domain">Google Domain</Label>
                    <Input
                      id="google_domain"
                      value={formData.google_domain}
                      onChange={(e) => handleChange("google_domain", e.target.value)}
                      placeholder="example.com"
                      disabled={isSubmitting}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Project Information */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Project Details
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="epic">Epic</Label>
                    <Input
                      id="epic"
                      value={formData.epic}
                      onChange={(e) => handleChange("epic", e.target.value)}
                      placeholder="e.g. Q1 2025 Release"
                      disabled={isSubmitting}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="project">Project</Label>
                    <Input
                      id="project"
                      value={formData.project}
                      onChange={(e) => handleChange("project", e.target.value)}
                      placeholder="e.g. Website Redesign"
                      disabled={isSubmitting}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Environment & Status */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Environment & Status
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={formData.environment}
                      onValueChange={(value) => handleChange("environment", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Development">Development</SelectItem>
                        <SelectItem value="Staging">Staging</SelectItem>
                        <SelectItem value="UAT">UAT</SelectItem>
                        <SelectItem value="Production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleChange("status", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1 sm:flex-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? "Update Customer" : "Create Customer"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
