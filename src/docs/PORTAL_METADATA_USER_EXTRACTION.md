# Portal Metadata User Extraction

## Problem Statement

When using a single shared Linear API key for all portal operations, all comments created from the portal appear to be from the API key owner (e.g., "David Hoang") instead of the actual portal user who posted the comment.

### Visual Comparison

```
BEFORE FIX:
┌─────────────────────────────────────┐
│ [David's Avatar] David Hoang        │  <- WRONG: API key owner
│                  Nov 6, 04:32 PM    │
│                                     │
│ This is my comment from Portal      │
└─────────────────────────────────────┘

AFTER FIX:
┌─────────────────────────────────────┐
│ [JD Initials] John Doe              │  <- CORRECT: Portal user
│               Nov 6, 04:32 PM       │
│                                     │
│ This is my comment from Portal      │
└─────────────────────────────────────┘
```

## Root Cause

- Single Linear API key used for all operations
- `comment.user` always shows API key owner
- Real user information stored in `[Portal Metadata]` footer

## Solution

Extract actual user information from `[Portal Metadata]` footer instead of using `comment.user` from Linear API.

### Metadata Format

Portal comments include metadata in one of two formats:

**Single-line (most common):**
```
[Portal Metadata] User: John Doe john@example.com Time: Nov 6, 2025, 04:58 PM GMT+7
```

**Multi-line (legacy):**
```
[Portal Metadata]
User: John Doe john@example.com
Time: Nov 6, 2025, 04:58 PM GMT+7
```

### Implementation

#### 1. Extract Function

Location: `/services/linear/helpers.ts`

```typescript
export interface PortalMetadata {
  userName: string;
  userEmail: string;
  timestamp: string;
  userInitials: string;
}

export function extractPortalMetadata(body: string): PortalMetadata | null
```

**Features:**
- Parses both single-line and multi-line formats
- Extracts user name, email, and timestamp
- Generates initials from name (e.g., "John Doe" → "JD")
- Returns null if no metadata found (falls back to Linear user)

#### 2. Usage in Comment Rendering

Location: `/components/IssueDetailModal.tsx`

```typescript
// Extract Portal Metadata
const portalMetadata = LinearHelpers.extractPortalMetadata(comment.body || "");

// Use Portal user if metadata exists
const displayName = portalMetadata
  ? portalMetadata.userName
  : comment.user?.name || "Unknown User";

const displayTime = portalMetadata
  ? portalMetadata.timestamp
  : formatDate(comment.createdAt);

const displayInitials = portalMetadata
  ? portalMetadata.userInitials
  : comment.user?.name?.substring(0, 2).toUpperCase() || "?";

// CRITICAL: Don't use Linear avatar for Portal users
const displayAvatarUrl = portalMetadata 
  ? undefined 
  : comment.user?.avatarUrl;

// Avatar component
<Avatar>
  <AvatarImage src={displayAvatarUrl} />
  <AvatarFallback>{displayInitials}</AvatarFallback>
</Avatar>
```

**Why Portal users don't get avatar images:**
- Portal users are NOT Linear users
- Linear avatar belongs to API key owner (e.g., David Hoang)
- Showing API key owner's avatar would be misleading
- Initials-only is clearer: shows it's a Portal user

### Visual Improvements

#### Comment Card Styling

- **Avatar size**: Reduced to 7×7 (h-7 w-7) for compact display
- **Gap**: Reduced to 2.5 (gap-2.5) between avatar and content
- **Padding**: Set to !p-3 with important flag to override base styles
- **Avatar image**: ONLY shows initials for Portal users (no Linear avatar image)
- **Initials fallback**: Shows user initials in colored avatar (bg-primary/10 text-primary)

#### Image Size Optimization

Created `/styles/markdown-images-fix.css` to limit image sizes:

```css
.prose img,
.ProseMirror img {
  max-width: 100%;
  max-height: 400px;
  width: auto;
  height: auto;
  object-fit: contain;
}
```

**Benefits:**
- Prevents oversized images from overwhelming modal
- Similar to Linear's image handling
- Click to view fullscreen on desktop
- Responsive on mobile (max-height: 250px)

#### Modal Size Optimization

Changed modal dimensions to be more compact:

```tsx
// Before: !max-w-5xl !w-[95vw] !h-[90vh]
// After:  !max-w-4xl !w-[92vw] !h-[88vh]
```

**Impact:**
- More comfortable viewing size
- Better visual hierarchy with nested modals
- Similar to Linear's modal proportions

## Debugging

### Console Logs

The extract function logs parsing attempts:

```
[extractPortalMetadata] Processing body: [Portal Metadata] User: John...
[extractPortalMetadata] SINGLE-LINE match: { userName: "John Doe", ... }
```

Comment rendering logs metadata extraction:

```
[IssueDetailModal] Comment metadata: {
  hasMetadata: true,
  linearUser: "David Hoang",
  portalUser: "John Doe",
  commentId: "abc123"
}
```

### Troubleshooting

**If user still shows as API key owner:**

1. Check console for `[extractPortalMetadata]` logs
2. Verify metadata format in comment body
3. Ensure regex patterns match actual format
4. Check if metadata was stripped before extraction

**If avatar still shows Linear user image:**

1. Verify `displayAvatarUrl` is undefined when portalMetadata exists
2. Check console for `[IssueDetailModal] Comment metadata` log
3. Confirm `hasMetadata: true` in console
4. Inspect Avatar component: `src` should be undefined for Portal users

**If images are still too large:**

1. Verify `/styles/markdown-images-fix.css` is imported
2. Check if image has inline styles overriding CSS
3. Inspect computed styles in DevTools

## Testing Checklist

- [ ] Portal comments show actual user name (not API key owner)
- [ ] Avatar shows ONLY initials for Portal users (no Linear image)
- [ ] Linear user comments still show their avatar image (when no metadata)
- [ ] Initials are colored with bg-primary/10 text-primary
- [ ] Timestamp shows portal metadata time (not createdAt)
- [ ] Images limited to max 400px height
- [ ] Modal size is comfortable (not too large)
- [ ] Comments are compact and readable
- [ ] Fallback to Linear user works when no metadata

## Performance Impact

- **Minimal**: Regex parsing only on comment render
- **No API calls**: All data already in comment body
- **Cached**: Comments cached with metadata included

## Security Notes

- Email addresses are extracted but not displayed in UI
- Only used internally for logging/debugging
- No sensitive data exposed to client-side logs

## Related Files

- `/services/linear/helpers.ts` - Extract function
- `/components/IssueDetailModal.tsx` - Comment rendering
- `/components/issue-detail/MarkdownRenderer.tsx` - Image rendering
- `/styles/markdown-images-fix.css` - Image size limits

## Version History

- **v1.0** (Nov 6, 2025): Initial implementation
  - Extract Portal Metadata function
  - Comment rendering with real user
  - Image size optimization
  - Modal size adjustment
