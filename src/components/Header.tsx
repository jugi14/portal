import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {  
  Moon,
  Sun,
  LogOut,
  Shield,
  LayoutGrid,
  BookOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionContext";
import { useTheme } from "../contexts/ThemeContext";
import { ROLE_DEFINITIONS } from "../types/permissions";
import teifiLogo from '../imports/svg-teifi-logo';

interface HeaderProps {
  customerName?: string;
  customerId?: string;  
  environment?: string;
}

function TeifiWordmark() {
  return (
    <div className="h-[32px] w-[140px]">
      <svg className="block size-full" fill="none" viewBox="0 0 419 92">
        <g clipPath="url(#clip0_teifi_header)">
          {/* Main "teifi" text */}
          <path d={teifiLogo.mainT1} fill="white"/>
          <path d={teifiLogo.mainE} fill="white"/>
          <path d={teifiLogo.mainI1} fill="white"/>
          <path d={teifiLogo.mainF} fill="white"/>
          <path d={teifiLogo.mainI2} fill="white"/>
          <path d={teifiLogo.mainI1Dot} fill="white"/>
          <path d={teifiLogo.mainI2Dot} fill="white"/>
          
          {/* "DIGITAL" text */}
          <path d={teifiLogo.digitalD} fill="white"/>
          <path d={teifiLogo.digitalI} fill="white"/>
          <path d={teifiLogo.digitalG} fill="white"/>
          <path d={teifiLogo.digitalI2} fill="white"/>
          <path d={teifiLogo.digitalT} fill="white"/>
          <path d={teifiLogo.digitalA} fill="white"/>
          <path d={teifiLogo.digitalL} fill="white"/>
          
          {/* Gradient dot */}
          <path d={teifiLogo.gradientDot} fill="url(#paint0_linear_teifi_header)"/>
        </g>
        <defs>
          <linearGradient id="paint0_linear_teifi_header" x1="276.741" y1="79" x2="496.628" y2="79" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00FFF3"/>
            <stop offset="0.02" stopColor="#00FCF3"/>
            <stop offset="0.48" stopColor="#0BC3FA"/>
            <stop offset="0.82" stopColor="#129FFE"/>
            <stop offset="1" stopColor="#1492FF"/>
          </linearGradient>
          <clipPath id="clip0_teifi_header">
            <rect width="419" height="92" fill="white"/>
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

export function Header({ customerName, customerId, environment }: HeaderProps) {
  const { user, signOut } = useAuth();
  const { userRole, hasPermission } = usePermissions();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('[Header] Logout error:', error);
    }
  };
  
  // CRITICAL: Handle navigation with reload when leaving team pages
  const handleNavigate = (path: string) => {
    // Check if currently on team detail page
    const isOnTeamPage = location.pathname.startsWith('/teams/');
    
    // If on team page and navigating away, force reload to clear cache
    if (isOnTeamPage && !path.startsWith('/teams/')) {
      window.location.href = path;
      return;
    }
    
    // Normal navigation for same context
    navigate(path, { replace: false });
  };
  
  // FIXED: Check permission instead of hardcoded roles
  // Only show admin menu to users with view_admin permission (superadmin, admin)
  // client_manager does NOT have view_admin permission
  const isAdmin = hasPermission('view_admin');
  
  // Get active admin tab
  const getActiveAdminTab = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return 'overview';
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/customers')) return 'customers';
    if (path.includes('/admin/teams')) return 'teams';
    return 'overview';
  };

  const activeAdminTab = getActiveAdminTab();
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-[#000000] border-gray-800/50 shadow-sm">
      <div className="flex h-full items-center px-4 md:px-6 gap-6 pl-16 md:pl-4">
        <div className="flex items-center flex-1 gap-8">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 transition-transform hover:scale-105">
            <TeifiWordmark />
          </div>
          
          {/* Main Navigation - Dashboard + Admin tabs */}
          <nav className="hidden md:flex items-center gap-2">
            {/* Dashboard - Always visible for all users */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate('/dashboard')}
              className={`text-xs transition-all flex items-center gap-1.5 ${
                location.pathname === '/dashboard' || location.pathname === '/'
                  ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Dashboard
            </Button>
            
            {/* Admin Navigation Tabs - Only for admin users */}
            {isAdmin && (
              <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate('/admin')}
                className={`text-xs transition-all ${
                  activeAdminTab === 'overview'
                    ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Overview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate('/admin/users')}
                className={`text-xs transition-all ${
                  activeAdminTab === 'users'
                    ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Users
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate('/admin/customers')}
                className={`text-xs transition-all ${
                  activeAdminTab === 'customers'
                    ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Customers
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigate('/admin/teams')}
                className={`text-xs transition-all ${
                  activeAdminTab === 'teams'
                    ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                Teams
              </Button>
            </>
            )}
            
            {/* Documentation - Available to all users */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate('/documentation')}
              className={`text-xs transition-all flex items-center gap-1.5 ${
                location.pathname === '/documentation'
                  ? 'text-[#00fcf3] bg-gradient-to-r from-[#00fcf3]/10 to-[#1492ff]/10 border-b-2 border-[#00fcf3]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Dark Mode Toggle - Hidden on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="hidden sm:flex text-white/80 hover:text-white hover:bg-white/10 h-9 w-9 rounded-full"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Avatar with Dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-white/10">
                  <Avatar className="h-9 w-9 border-2 border-white/20">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.name || 'User'} />
                    <AvatarFallback className="bg-gradient-to-br from-[#1492ff] to-[#00fcf3] text-white">
                      {(user.user_metadata?.name || user.email || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal pb-3">
                  <div className="flex flex-col space-y-2">
                    <p className="text-base font-semibold leading-none">
                      {user.user_metadata?.name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    {userRole?.role && (
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline" className="w-fit bg-primary/5 border-primary/20">
                          <Shield className="h-3 w-3 mr-1" />
                          {ROLE_DEFINITIONS[userRole.role].name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={toggleDarkMode}
                  className="cursor-pointer py-2.5 hover:bg-accent sm:hidden"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="mr-3 h-4 w-4" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="mr-3 h-4 w-4" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}