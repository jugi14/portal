/**
 * Sidebar Types and Interfaces
 * 
 * Centralized type definitions for sidebar components
 * Following Schema V2.0 camelCase convention
 */

import { UserRole } from '../../types/permissions';

export interface TeamHierarchyNode {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
  level: number;
  childCount?: number;
  totalDescendants?: number;
  children?: TeamHierarchyNode[];
  parentId?: string | null;
  parentName?: string | null;
  membersCount?: number;
  customersCount?: number;
  
  // Backward compatibility
  parent_id?: string | null;
  parent_name?: string | null;
  members_count?: number;
  customers_count?: number;
}

export interface SidebarProps {
  // NOTE: Dashboard navigation moved to Header - activeTab no longer needed
  onTabChange?: (tab: string) => void;
  userRole?: UserRole | null;
  canNavigateTo?: (tab: string) => boolean;
  isNavigating?: boolean;
}

export interface SidebarContentProps {
  effectivelyCollapsed: boolean;
  // activeTab removed - navigation now in header
  handleNavigate: (path: string, tab: string) => void;
  handleLogout: () => void;
}
