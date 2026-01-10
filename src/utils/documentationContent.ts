/**
 * Documentation Content
 * 
 * Embedded documentation content for the Client Portal
 */

export interface DocSection {
  id: string;
  title: string;
  content: string;
}

export const CLIENT_UAT_WORKFLOW = `
# Client UAT Workflow Guide

Welcome to the Teifi Digital Client Portal! We're excited to have you on board. This guide will walk you through our User Acceptance Testing (UAT) workflow step-by-step. Don't worry if you're new to this process - we'll guide you every step of the way.

---

## Overview

The UAT workflow consists of **5 main stages**:

| Stage | Description | Your Action |
|-------|-------------|-------------|
| **Pending Review** | Features ready for your review | Test and provide feedback |
| **Blocked/Needs Input** | Waiting for your feedback | Answer questions, provide info |
| **Approved** | Features you've completed | Review before release |
| **Released** | Features deployed to production | Verify in production |
| **Failed Review** | Canceled or duplicate items | Reference only |

### Visual Workflow

\`\`\`mermaid
graph LR
    A[Development Complete] --> B[Pending Review]
    B --> C{Client Testing}
    C -->|Issues Found| D[Blocked/Needs Input]
    C -->|Approved| E[Approved]
    D -->|Resolved| B
    E --> F[Released to Production]
    C -->|Canceled| G[Failed Review]
    
    style B fill:#fbbf24,stroke:#f59e0b,color:#000
    style D fill:#ef4444,stroke:#dc2626,color:#fff
    style E fill:#10b981,stroke:#059669,color:#fff
    style F fill:#3b82f6,stroke:#2563eb,color:#fff
    style G fill:#6b7280,stroke:#4b5563,color:#fff
\`\`\`

---

## Getting Started

### Accessing Your Dashboard

1. Log in to the Client Portal
2. Navigate to your team's dashboard
3. Click the **Tasks** tab to view the UAT Kanban board
4. Each column represents a workflow stage

### Understanding the Kanban Board

The board displays features as cards that move through stages:

- **Left to Right** = Progress through workflow
- **Card Color** = Priority level
- **Badges** = Status indicators
- **Click Card** = View full details

---

## Testing Features

### Step 1: Find Features to Test

Navigate to the **Pending Review** column. Each card shows:
- Feature title and description
- Test instructions
- Screenshots or mockups
- Acceptance criteria

### Step 2: Perform Your Testing

**Testing Checklist:**

- [ ] Read the feature description carefully
- [ ] Follow the test instructions step-by-step
- [ ] Try different scenarios and edge cases
- [ ] Test on multiple devices (if applicable)
- [ ] Check for visual issues
- [ ] Verify functionality matches requirements
- [ ] Note any bugs or concerns

**Pro Tips:**
- Take screenshots of any issues
- Try to "break" the feature (edge cases)
- Test as an end user would use it
- Document your testing process

### Step 3: Provide Feedback

#### If Everything Works:

1. Click **Approve** button
2. Add optional comments about what you tested
3. Feature moves to **Approved** column
4. Development team deploys to production

#### If Changes Are Needed:

1. Click **Request Changes**
2. Describe issues clearly:
   - What you expected
   - What actually happened
   - Steps to reproduce
   - Screenshots if helpful
3. Feature returns to development

#### If You Need More Information:

1. Click **Needs Input**
2. Ask specific questions
3. Feature moves to **Blocked** column
4. Development team responds

---

## Best Practices

### Clear Communication

**Good Feedback:**
> "The submit button on the contact form doesn't work on mobile Safari. Steps: 1) Open form on iPhone, 2) Fill out fields, 3) Tap Submit. Expected: Form submits. Actual: Nothing happens."

**Poor Feedback:**
> "Button broken"

### Timely Reviews

- Review features within **2-3 business days**
- Set aside dedicated testing time
- Prioritize blocking issues
- Communicate delays if needed

### Quality Standards

- Don't approve features with known issues
- Even minor bugs should be reported
- Better to request changes than accept problems
- Your approval = Ready for production

---

## Common Questions

### Q: How long should I spend testing?

**A:** 5-15 minutes per feature depending on complexity. Focus on:
- Core functionality
- User experience
- Visual appearance
- Edge cases

### Q: What if I'm unsure about something?

**A:** Use the **Needs Input** option to ask questions. Better to clarify than guess.

### Q: Can I approve with minor issues?

**A:** No. Request changes for any issues, even small ones. Quality is important.

### Q: What happens after I approve?

**A:** The team deploys to production within 1-2 business days. You'll see it in the **Released** column.

### Q: Can I retest after changes?

**A:** Yes. Once changes are made, the feature returns to **Pending Review** for re-testing.

---

## Workflow States Explained

### Pending Review

**What it means:** Feature is complete and ready for your testing.

**Your actions:**
- Test the feature thoroughly
- Approve, request changes, or ask questions
- Provide detailed feedback

### Blocked/Needs Input

**What it means:** Development team needs information from you.

**Your actions:**
- Review the questions/comments
- Provide requested information
- Answer as soon as possible

### Approved

**What it means:** You've tested and approved the feature.

**Your actions:**
- Wait for deployment
- Review before release if needed
- Feature will move to Released

### Released

**What it means:** Feature is live in production.

**Your actions:**
- Verify it works in production
- Report any production issues
- Celebrate the successful release

### Failed Review

**What it means:** Feature was canceled or marked as duplicate.

**Your actions:**
- Reference only
- No action needed

---

## Support & Help

### Need Assistance?

- **Project Manager:** Contact your assigned PM
- **Email:** support@teifi.com
- **In-App Chat:** Use the help button
- **Emergency:** Call your account manager

### Reporting Bugs

If you find a bug in the portal itself:

1. Note what you were doing
2. Take a screenshot
3. Email support@teifi.com
4. Include browser/device information

---

## Tips for Success

### Effective Testing

- Test systematically (don't skip steps)
- Document everything you try
- Think like an end user
- Be thorough but efficient

### Clear Feedback

- Be specific about issues
- Provide reproduction steps
- Include screenshots/videos
- Suggest solutions if possible

### Timely Communication

- Review promptly
- Ask questions early
- Communicate blockers
- Follow up on changes

---

**Need help?** Contact support@teifi.com
`;

export const SUPERADMIN_INITIALIZATION = `
# Superadmin Initialization Guide

This guide is for system administrators managing the Teifi Client Portal.

## Overview

Superadmins have full access to the system including:
- User management
- Customer management
- Team assignments
- System configuration
- Activity monitoring

---

## Initial Setup

### First-Time Initialization

1. **Create Superadmin Account**
   - Sign up with your admin email
   - Verify email address
   - Initial role will be set automatically

2. **System Configuration**
   - Navigate to Admin > System
   - Review system settings
   - Configure Linear integration if needed

3. **Create Customers**
   - Go to Admin > Customers
   - Click "Create Customer"
   - Enter customer name and description
   - Save customer

4. **Create Users**
   - Go to Admin > Users
   - Click "Create User"
   - Enter user details (name, email, role)
   - Assign to appropriate customers
   - Save user

### Setup Workflow

\`\`\`mermaid
graph TD
    Start[First Login] --> CheckSuper{Is Superadmin?}
    CheckSuper -->|No| Deny[Access Denied]
    CheckSuper -->|Yes| Dashboard[Admin Dashboard]
    
    Dashboard --> CreateCust[Create Customers]
    CreateCust --> CreateUser[Create Users]
    CreateUser --> AssignCust[Assign Users to Customers]
    AssignCust --> AssignTeam[Assign Teams to Customers]
    AssignTeam --> Config[Configure Settings]
    Config --> Monitor[Monitor System]
    
    style Start fill:#3b82f6,stroke:#2563eb,color:#fff
    style Dashboard fill:#10b981,stroke:#059669,color:#fff
    style CreateCust fill:#fbbf24,stroke:#f59e0b,color:#000
    style CreateUser fill:#fbbf24,stroke:#f59e0b,color:#000
    style AssignCust fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style AssignTeam fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style Config fill:#06b6d4,stroke:#0891b2,color:#fff
    style Monitor fill:#10b981,stroke:#059669,color:#fff
    style Deny fill:#ef4444,stroke:#dc2626,color:#fff
\`\`\`

### Customer Setup Process

\`\`\`mermaid
sequenceDiagram
    participant SA as Superadmin
    participant System as Portal System
    participant Linear as Linear API
    
    SA->>System: Create Customer
    System->>System: Save to Database
    SA->>System: Assign Teams
    System->>Linear: Fetch Team List
    Linear-->>System: Return Teams
    System->>System: Link Teams to Customer
    SA->>System: Create/Assign Users
    System->>System: Set User Roles
    System->>System: Assign to Customer
    System-->>SA: Setup Complete
\`\`\`

---

## User Roles

### Role Hierarchy

1. **superadmin** - Full system access
2. **admin** - Manage users and customers
3. **client_manager** - Manage customer teams
4. **client_user** - View customer teams
5. **tester** - Limited testing access
6. **viewer** - Read-only access

\`\`\`mermaid
graph TD
    SA[Superadmin<br/>Full System Access] --> A[Admin<br/>Manage Users & Customers]
    A --> CM[Client Manager<br/>Manage Customer Teams]
    CM --> CU[Client User<br/>View & Test Features]
    CU --> T[Tester<br/>Limited Testing]
    T --> V[Viewer<br/>Read-Only]
    
    style SA fill:#dc2626,stroke:#991b1b,color:#fff
    style A fill:#ea580c,stroke:#c2410c,color:#fff
    style CM fill:#fbbf24,stroke:#f59e0b,color:#000
    style CU fill:#10b981,stroke:#059669,color:#fff
    style T fill:#3b82f6,stroke:#2563eb,color:#fff
    style V fill:#6b7280,stroke:#4b5563,color:#fff
\`\`\`

### Permission Flow

\`\`\`mermaid
flowchart LR
    User[User Login] --> Auth{Authentication}
    Auth -->|Success| Role{Check Role}
    Auth -->|Failed| Deny[Access Denied]
    
    Role -->|Superadmin| Full[Full Access<br/>All Features]
    Role -->|Admin| AdminAccess[Manage<br/>Users & Customers]
    Role -->|Client Manager| CMAccess[Manage<br/>Customer Teams]
    Role -->|Client User| CUAccess[View & Test<br/>Features]
    Role -->|Tester/Viewer| Limited[Limited/Read-Only<br/>Access]
    
    style Full fill:#dc2626,stroke:#991b1b,color:#fff
    style AdminAccess fill:#ea580c,stroke:#c2410c,color:#fff
    style CMAccess fill:#fbbf24,stroke:#f59e0b,color:#000
    style CUAccess fill:#10b981,stroke:#059669,color:#fff
    style Limited fill:#6b7280,stroke:#4b5563,color:#fff
    style Deny fill:#1f2937,stroke:#374151,color:#fff
\`\`\`

### Role Permissions

**Superadmin**
- All admin permissions
- Manage other superadmins
- System configuration
- Activity monitoring

**Admin**
- Create/edit/delete users
- Create/edit/delete customers
- Assign users to customers
- Assign teams to customers

**Client Manager**
- View assigned customers
- Manage customer team assignments
- View team issues and tasks

**Client User**
- View assigned customer teams
- Test and approve features
- Comment on issues

**Tester**
- View specific teams
- Test features
- Report bugs

**Viewer**
- Read-only access
- View teams and issues
- No editing capabilities

---

## Managing Customers

### Creating a Customer

1. Navigate to Admin > Customers
2. Click "Create Customer"
3. Fill in customer details:
   - Name (required)
   - Description (optional)
4. Click "Save"

### Assigning Users to Customers

1. Open customer details
2. Click "Manage Members"
3. Search for users
4. Select users to assign
5. Click "Add Members"

### Assigning Teams to Customers

1. Open customer details
2. Click "Manage Teams"
3. Select Linear teams from dropdown
4. Click "Assign Team"

---

## Managing Users

### Creating Users

1. Navigate to Admin > Users
2. Click "Create User"
3. Enter user information:
   - Full name
   - Email address
   - Role (select from dropdown)
4. Assign to customers (optional)
5. Click "Create User"

### Editing Users

1. Find user in Admin > Users
2. Click edit icon
3. Update user details
4. Modify role if needed
5. Update customer assignments
6. Click "Save Changes"

### Deleting Users

1. Find user in Admin > Users
2. Click delete icon
3. Confirm deletion
4. User will be permanently removed

---

## System Monitoring

### Activity Logs

- View recent system activity
- Track user actions
- Monitor customer changes
- Review team assignments

### Performance Insights

- Check cache performance
- Monitor API usage
- Review system health
- Identify bottlenecks

---

## Best Practices

### Security

- Use strong passwords
- Enable 2FA if available
- Regular security audits
- Limit superadmin accounts

### User Management

- Assign minimal necessary permissions
- Regular user access reviews
- Remove inactive users
- Document role changes

### Customer Organization

- Clear naming conventions
- Detailed descriptions
- Regular team assignment reviews
- Monitor customer activity

---

## Troubleshooting

### Common Issues

**User can't access teams**
- Check customer assignment
- Verify team assignment to customer
- Check user role permissions

**Customer not showing teams**
- Verify teams are assigned
- Check Linear integration
- Refresh team hierarchy

**Permission errors**
- Verify user role
- Check customer membership
- Review team access

---

## Support

For technical support:
- Email: support@teifi.com
- Documentation: https://docs.teifidigital.com
- Emergency: Contact your account manager

---

*Last updated: January 2025*
`;

export const DEVELOPMENT_GUIDELINES = `
# Development Guidelines

Core principles and best practices for the Teifi Client Portal.

## Overview

This is a condensed version of the full development guidelines. For complete documentation, see the Guidelines.md file in the project repository.

---

## Core Principles

### 1. KISS (Keep It Simple, Stupid)

- Simple solutions are easier to understand and maintain
- Use straightforward, readable code
- Prefer built-in features over complex abstractions
- Keep component logic focused

### 2. DRY (Don't Repeat Yourself)

- Use existing contexts (Auth, Permissions)
- Extract repeated logic into hooks
- Create reusable components
- Centralize configuration

### 3. Performance

- Fewer layers = faster app
- Use React.memo() for expensive components
- Leverage caching strategically
- Batch API requests
- Optimize re-renders

### 4. Maintainability

- Write self-documenting code
- Keep functions small (< 50 lines)
- Use TypeScript types strictly
- Keep files reasonable (< 500 lines)

---

## Architecture

### Available Contexts

- **AuthContext** - User authentication & session
- **PermissionContext** - Role-based access control
- **SidebarContext** - Sidebar state
- **ThemeContext** - Light/dark theme

### Service Layer

- **linearTeamService** - Team data
- **linearTeamIssuesService** - Issue data
- **customerServiceV2** - Customer management
- **userServiceV2** - User management
- **cacheService** - Generic caching

---

## Code Style

### Naming Conventions

\`\`\`typescript
// Components: PascalCase
function TeamDetailPage() {}

// Hooks: camelCase with "use" prefix
function useTeamAccess() {}

// Services: camelCase with suffix
const linearTeamService = {};

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
\`\`\`

### Import Order

1. React & external libraries
2. Contexts
3. Hooks
4. Services
5. Components
6. Types
7. Utils

---

## Security

### Critical Rules

- Never use \`innerHTML\` with user input
- No \`dangerouslySetInnerHTML\` without sanitization
- Use \`textContent\` or DOM API methods
- Never log token information
- Validate all user input

---

## Performance Best Practices

### Caching Strategy

\`\`\`typescript
// Use cache service
const { data, loading } = useCache(
  'cache-key',
  fetchFunction,
  { ttl: 5 * 60 * 1000 }
);
\`\`\`

### Memoization

\`\`\`typescript
// Memoize expensive computations
const filtered = useMemo(
  () => data.filter(fn),
  [data]
);

// Memoize callbacks
const handleClick = useCallback(
  (id) => { /* ... */ },
  [dep]
);
\`\`\`

---

## Quick Checklist

Before submitting code:

- [ ] Used existing contexts/services
- [ ] No duplicate logic
- [ ] Components < 500 lines
- [ ] Proper TypeScript types
- [ ] Memoized expensive operations
- [ ] Error handling in place
- [ ] Security best practices followed

---

*For full guidelines, see Guidelines.md in the repository*
`;

export const DOCUMENTATION_CONTENT: Record<string, string> = {
  'client-uat-workflow': CLIENT_UAT_WORKFLOW,
  'superadmin-init': SUPERADMIN_INITIALIZATION,
  'guidelines': DEVELOPMENT_GUIDELINES,
};