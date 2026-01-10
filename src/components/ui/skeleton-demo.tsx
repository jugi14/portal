/**
 * Skeleton Demo Showcase - Teifi Client Portal
 * 
 * Professional demonstration of all skeleton loading states
 * Optimized for dark/light modes and responsive layouts
 * 
 * GUIDELINES COMPLIANCE:
 * - KISS: Simple, clear demonstration
 * - DRY: Uses skeleton-library components
 * - Performance: Lightweight showcase
 * - NO EMOJIS: Clean professional code
 */

import React, { useState } from 'react';
import { 
  KanbanCardSkeleton,
  KanbanColumnSkeleton,
  KanbanBoardSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
  ListSkeleton,
  SidebarSkeleton,
  HeaderSkeleton,
  FormSkeleton,
  ModalSkeleton,
  TeamCardSkeleton,
  TeamGridSkeleton,
  IssueDetailSkeleton,
  PageSkeleton,
  CompactSkeleton,
} from './skeleton-library';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';

export function SkeletonDemo() {
  const [activeTab, setActiveTab] = useState('kanban');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Skeleton Loading States</h1>
          <p className="text-muted-foreground">
            Professional skeleton components for Teifi Client Portal - Optimized for dark/light modes and responsive layouts
          </p>
        </div>

        {/* Demo Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Skeleton Library</CardTitle>
            <CardDescription>
              Select a category to view different skeleton loading patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
                <TabsTrigger value="tables">Tables</TabsTrigger>
                <TabsTrigger value="lists">Lists</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="forms">Forms</TabsTrigger>
                <TabsTrigger value="layouts">Layouts</TabsTrigger>
                <TabsTrigger value="misc">Misc</TabsTrigger>
              </TabsList>

              {/* Kanban Skeletons */}
              <TabsContent value="kanban" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Kanban Card</h3>
                    <Badge variant="secondary">Mobile & Desktop</Badge>
                  </div>
                  <KanbanCardSkeleton className="max-w-sm" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Kanban Column</h3>
                    <Badge variant="secondary">Responsive</Badge>
                  </div>
                  <ScrollArea className="w-full">
                    <KanbanColumnSkeleton />
                  </ScrollArea>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Full Kanban Board</h3>
                    <Badge variant="secondary">Horizontal Scroll</Badge>
                  </div>
                  <ScrollArea className="w-full">
                    <KanbanBoardSkeleton />
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Stats Skeletons */}
              <TabsContent value="stats" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Single Stat Card</h3>
                    <Badge variant="secondary">Dashboard</Badge>
                  </div>
                  <StatCardSkeleton className="max-w-sm" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Stats Grid</h3>
                    <Badge variant="secondary">Responsive Grid</Badge>
                  </div>
                  <StatsGridSkeleton />
                </div>
              </TabsContent>

              {/* Table Skeletons */}
              <TabsContent value="tables" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Data Table</h3>
                    <Badge variant="secondary">5 Rows x 5 Columns</Badge>
                  </div>
                  <TableSkeleton />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Compact Table</h3>
                    <Badge variant="secondary">3 Rows x 4 Columns</Badge>
                  </div>
                  <TableSkeleton rows={3} columns={4} />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">No Header Table</h3>
                    <Badge variant="secondary">Headerless</Badge>
                  </div>
                  <TableSkeleton rows={4} columns={3} showHeader={false} />
                </div>
              </TabsContent>

              {/* List Skeletons */}
              <TabsContent value="lists" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Standard List</h3>
                    <Badge variant="secondary">5 Items</Badge>
                  </div>
                  <ListSkeleton className="max-w-md" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Compact List</h3>
                    <Badge variant="secondary">3 Items</Badge>
                  </div>
                  <ListSkeleton items={3} className="max-w-md" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Compact Skeleton</h3>
                    <Badge variant="secondary">Minimal</Badge>
                  </div>
                  <CompactSkeleton className="max-w-md" />
                </div>
              </TabsContent>

              {/* Team Skeletons */}
              <TabsContent value="teams" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Team Card</h3>
                    <Badge variant="secondary">With Stats</Badge>
                  </div>
                  <TeamCardSkeleton className="max-w-sm" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Team Grid</h3>
                    <Badge variant="secondary">Responsive Grid</Badge>
                  </div>
                  <TeamGridSkeleton />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Issue Detail</h3>
                    <Badge variant="secondary">Full Modal</Badge>
                  </div>
                  <Card className="p-6">
                    <IssueDetailSkeleton />
                  </Card>
                </div>
              </TabsContent>

              {/* Form Skeletons */}
              <TabsContent value="forms" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Form Skeleton</h3>
                    <Badge variant="secondary">4 Fields</Badge>
                  </div>
                  <Card className="p-6 max-w-md">
                    <FormSkeleton />
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Compact Form</h3>
                    <Badge variant="secondary">2 Fields</Badge>
                  </div>
                  <Card className="p-6 max-w-md">
                    <FormSkeleton fields={2} />
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Modal Skeleton</h3>
                    <Badge variant="secondary">Full Dialog</Badge>
                  </div>
                  <ModalSkeleton />
                </div>
              </TabsContent>

              {/* Layout Skeletons */}
              <TabsContent value="layouts" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Header Skeleton</h3>
                    <Badge variant="secondary">App Header</Badge>
                  </div>
                  <HeaderSkeleton />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Sidebar Skeleton</h3>
                    <Badge variant="secondary">Navigation</Badge>
                  </div>
                  <Card className="w-64 h-[600px]">
                    <SidebarSkeleton />
                  </Card>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">Full Page Skeleton</h3>
                    <Badge variant="secondary">Complete Layout</Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <PageSkeleton />
                  </div>
                </div>
              </TabsContent>

              {/* Misc Skeletons */}
              <TabsContent value="misc" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h4 className="font-semibold mb-4">Light Mode</h4>
                    <div className="space-y-3">
                      <KanbanCardSkeleton />
                      <StatCardSkeleton />
                    </div>
                  </Card>

                  <Card className="p-6 dark bg-black text-white">
                    <h4 className="font-semibold mb-4">Dark Mode</h4>
                    <div className="space-y-3">
                      <KanbanCardSkeleton />
                      <StatCardSkeleton />
                    </div>
                  </Card>
                </div>

                <Card className="p-6">
                  <h4 className="font-semibold mb-4">Responsive Preview</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Resize your browser to see skeleton components adapt to different screen sizes
                  </p>
                  <div className="space-y-4">
                    <StatsGridSkeleton cardCount={4} />
                    <TeamGridSkeleton teams={3} />
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Instructions</CardTitle>
            <CardDescription>
              How to use skeleton components in your application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Import</h4>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{`import { 
  KanbanBoardSkeleton,
  StatsGridSkeleton,
  TableSkeleton 
} from './components/ui/skeleton-library';`}</code>
              </pre>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Basic Usage</h4>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{`{loading ? (
  <KanbanBoardSkeleton columnCount={4} cardsPerColumn={3} />
) : (
  <KanbanBoard data={data} />
)}`}</code>
              </pre>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Features</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Optimized for dark and light modes</li>
                <li>Fully responsive (mobile, tablet, desktop)</li>
                <li>GPU-accelerated shimmer animations</li>
                <li>Accessibility support (reduced motion)</li>
                <li>Customizable via className prop</li>
                <li>Type-safe with TypeScript</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
