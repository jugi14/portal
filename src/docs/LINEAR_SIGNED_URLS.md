# Linear Signed URLs for File Attachments

## Overview

The Client Portal now supports **public access to Linear file attachments** without requiring authentication. This allows clients to view images and files in issue comments and descriptions directly in their browser.

## Implementation

### How It Works

When making GraphQL requests to Linear's API, we include the `public-file-urls-expire-in` header with a value in seconds. Linear then returns **signed URLs** for all file attachments in the response, which provide temporary access without authentication.

**Expiration Time**: 1 hour (3600 seconds)

### Modified Files

1. **`/supabase/functions/server/linearTeamIssuesService.tsx`**
   - Added `"public-file-urls-expire-in": "3600"` header to fetch requests (line 138)
   - All GraphQL queries executed through this service now return signed URLs

2. **`/supabase/functions/server/linearTeamService.tsx`**
   - Added `"public-file-urls-expire-in": "3600"` header to fetch requests (line 131)
   - Ensures team-related queries also return signed URLs

3. **`/supabase/functions/server/linearGraphQL.tsx`**
   - Updated documentation to explain signed URL functionality
   - Version bumped to 1.1.0

### Example Request

```typescript
const response = await fetch(LINEAR_API_URL, {
  method: "POST",
  headers: {
    Authorization: apiKey,
    "Content-Type": "application/json",
    "User-Agent": "Teifi-Digital-Client-Portal/1.0",
    "public-file-urls-expire-in": "3600", // Request 1-hour signed URLs
  },
  body: JSON.stringify({ query, variables }),
});
```

### Example Response

Before (without header):
```json
{
  "data": {
    "issue": {
      "attachments": {
        "nodes": [
          {
            "url": "https://uploads.linear.app/6db02bb9-fba2-473b-8f9d-f38188e84c72/image.png"
          }
        ]
      }
    }
  }
}
```

After (with header):
```json
{
  "data": {
    "issue": {
      "attachments": {
        "nodes": [
          {
            "url": "https://uploads.linear.app/6db02bb9-fba2-473b-8f9d-f38188e84c72/image.png?Expires=1730930340&Signature=..."
          }
        ]
      }
    }
  }
}
```

## Frontend Integration

The frontend components already support signed URLs with **no modifications required**:

### MarkdownRenderer Component

```tsx
// /components/issue-detail/MarkdownRenderer.tsx (line 102-109)
img: ({ src, alt }) => (
  <img 
    src={src}  // Signed URL works automatically
    alt={alt || ''} 
    className="max-w-full h-auto rounded-lg border border-border my-3"
    loading="lazy"
  />
)
```

Images in markdown (comments, descriptions) are rendered directly using the signed URL from Linear.

### Comment Images

When users paste images into comments, the images are uploaded to Linear and the markdown includes the image URL. With signed URLs enabled, these images are viewable by all clients without authentication.

## Benefits

1. **Client Access**: Clients can view attachments without Linear accounts
2. **Security**: URLs expire after 1 hour, limiting exposure
3. **Transparent**: No frontend code changes needed
4. **Automatic**: Works for all issue queries (details, lists, comments)

## Security Considerations

- **Expiration**: URLs are valid for 1 hour from request time
- **Public Access**: Anyone with the URL can view the file during validity period
- **No Authentication**: URLs work without Linear API key or user session
- **Refreshable**: New signed URLs are generated on each API request

## Use Cases

1. **Client UAT Board**: Clients can see screenshots in bug reports
2. **Issue Comments**: Clients can view images posted by developers
3. **Issue Descriptions**: Design mockups and attachments are visible
4. **Mobile Access**: Works on any device without special configuration

## Reference

- [Linear Documentation: File Storage Authentication](https://linear.app/developers/file-storage-authentication)
- [Linear GraphQL API: Request Signed URLs](https://linear.app/developers/file-storage-authentication#request-signed-urls)

## Troubleshooting

### Images Not Loading

**Problem**: Images show broken link icon

**Solutions**:
1. Check if URL includes `?Expires=` and `Signature=` query parameters
2. Verify expiration timestamp hasn't passed (1 hour validity)
3. Refresh the issue to get new signed URLs
4. Check browser console for CORS or network errors

### Old URLs Not Working

**Problem**: Cached issue data has expired URLs

**Solutions**:
1. Refresh the page to fetch new data
2. Clear browser cache
3. Re-open the issue modal to fetch fresh details

## Testing

To verify signed URLs are working:

1. Open an issue with attachments in the Client Portal
2. Right-click an image and "Copy Image URL"
3. Paste URL in a new incognito tab
4. Image should load without authentication
5. URL should contain `?Expires=` and `Signature=` parameters

## Deployment

No additional configuration needed. The feature is active as soon as the backend changes are deployed to Supabase Edge Functions.

**Version**: 1.0.0  
**Updated**: 2025-11-06  
**Author**: Teifi Digital Development Team
