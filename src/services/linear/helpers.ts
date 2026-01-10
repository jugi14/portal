import type { LinearIssue, LinearLabel, LinearComment, LinearAttachment } from './types';

export function extractArrayFromResponse(data: any[] | { nodes: any[] } | undefined): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.nodes && Array.isArray(data.nodes)) return data.nodes;
  return [];
}

export function getIssueLabels(issue: LinearIssue): LinearLabel[] {
  return extractArrayFromResponse(issue.labels);
}

export function getIssueComments(issue: LinearIssue): LinearComment[] {
  return extractArrayFromResponse(issue.comments);
}

export function getIssueAttachments(issue: LinearIssue): LinearAttachment[] {
  return extractArrayFromResponse(issue.attachments);
}

export function getDataStructure(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }
  
  if (Array.isArray(data)) {
    return `Array(${data.length})`;
  }
  
  if (typeof data === 'object') {
    const structure: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        structure[key] = null;
      } else if (Array.isArray(value)) {
        structure[key] = `Array(${value.length})`;
      } else if (typeof value === 'object') {
        structure[key] = `Object(${Object.keys(value).length} keys)`;
      } else {
        structure[key] = typeof value;
      }
    }
    return structure;
  }
  
  return typeof data;
}

export function validateTeamId(teamId: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(teamId);
}

export function generateRequestId(): string {
  return `req-${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateHierarchyBreakdown(subIssues: LinearIssue[]): {
  level1: number;
  level2: number;
  level3Plus: number;
  byState: Record<string, number>;
  total: number;
} {
  const breakdown = {
    level1: 0,
    level2: 0,
    level3Plus: 0,
    byState: {} as Record<string, number>,
    total: 0
  };

  function processIssue(issue: LinearIssue, level: number) {
    if (level === 1) breakdown.level1++;
    else if (level === 2) breakdown.level2++;
    else breakdown.level3Plus++;

    breakdown.total++;

    const stateName = issue.state?.name || 'Unknown';
    breakdown.byState[stateName] = (breakdown.byState[stateName] || 0) + 1;

    if (issue.subIssues && issue.subIssues.length > 0) {
      issue.subIssues.forEach(sub => processIssue(sub, level + 1));
    }
  }

  subIssues.forEach(issue => processIssue(issue, 1));

  return breakdown;
}

export function buildHierarchyTree(flatIssues: LinearIssue[]): LinearIssue[] {
  const issueMap = new Map<string, LinearIssue>();
  const rootIssues: LinearIssue[] = [];

  flatIssues.forEach(issue => {
    issueMap.set(issue.id, { ...issue, subIssues: [] });
  });

  flatIssues.forEach(issue => {
    const issueWithSubs = issueMap.get(issue.id);
    if (!issueWithSubs) return;

    if (issue.parent?.id) {
      const parent = issueMap.get(issue.parent.id);
      if (parent) {
        if (!parent.subIssues) parent.subIssues = [];
        parent.subIssues.push(issueWithSubs);
      } else {
        rootIssues.push(issueWithSubs);
      }
    } else {
      rootIssues.push(issueWithSubs);
    }
  });

  return rootIssues;
}

export function enhanceIssuesWithHierarchy(issues: LinearIssue[]): LinearIssue[] {
  return issues.map(issue => {
    const enhanced = { ...issue };
    
    if (issue.subIssues && issue.subIssues.length > 0) {
      const breakdown = calculateHierarchyBreakdown(issue.subIssues);
      enhanced._hierarchyBreakdown = breakdown;
      enhanced._originalSubIssueCount = breakdown.total;
    }
    
    return enhanced;
  });
}

/**
 * Strip [external] prefix from comment body for display
 * 
 * Handles multiple formats:
 * - [external] Comment text
 * - [EXTERNAL] Comment text
 * - \\[external\\] Comment text (escaped)
 * - [External] Comment text
 * 
 * Also strips metadata footer added by system:
 * SINGLE-LINE: [Portal Metadata] User: ... Time: ...
 * MULTI-LINE:  [Portal Metadata]\nUser: ...\nTime: ...
 * 
 * @param body - Comment body text
 * @returns Clean comment text without [external] prefix and metadata
 */
export function stripExternalPrefix(body: string): string {
  if (!body) return '';
  
  // ROBUST CASE-INSENSITIVE PREFIX REMOVAL:
  // 1. Remove ALL backslashes first (handles escaped brackets: \\[external\\])
  // 2. Trim all whitespace
  // 3. Remove BOM and special characters
  const normalized = body
    .replaceAll('\\', '')                 // Remove ALL backslashes (unescapes \\[ and \\])
    .trim()                           // Remove whitespace
    .replace(/^\uFEFF/, '');          // Remove BOM if present
  
  // Case-insensitive regex to match [external] at start
  const externalPrefixRegex = /^\[external\]\s*/i;
  
  let cleaned = normalized;
  
  if (externalPrefixRegex.test(normalized)) {
    cleaned = normalized.replace(externalPrefixRegex, '').trim();
  }
  
  // CRITICAL: Strip SINGLE-LINE metadata format (most common now)
  // Pattern: [Portal Metadata] User: ... Time: ...
  // Must match complete metadata including email and timezone
  // Example: [Portal Metadata] User: David Hoang david.t@teifi.com Time: Oct 18, 2025, 10:33 PM GMT+7
  // EXACT SAME REGEX as stripMetadataFromDescription()
  const singleLineMetadataRegex = /\s*\[Portal Metadata\]\s*User:.*Time:.*$/gim;
  cleaned = cleaned.replace(singleLineMetadataRegex, '').trim();
  
  // Strip MULTI-LINE metadata footer if present (legacy format)
  // Format: \n\n[Portal Metadata]\nUser: ...\nTime: ...
  // Try both double newline and single newline versions
  let metadataSeparatorIndex = cleaned.indexOf('\n\n[Portal Metadata]');
  if (metadataSeparatorIndex === -1) {
    metadataSeparatorIndex = cleaned.indexOf('\n[Portal Metadata]');
  }
  
  if (metadataSeparatorIndex !== -1) {
    cleaned = cleaned.substring(0, metadataSeparatorIndex).trim();
  }
  
  // LEGACY FORMAT: \n---\nPosted by: ...
  const legacyMetadataSeparatorIndex = cleaned.indexOf('\n---\nPosted by:');
  if (legacyMetadataSeparatorIndex !== -1) {
    cleaned = cleaned.substring(0, legacyMetadataSeparatorIndex).trim();
  }
  
  return cleaned;
}

/**
 * Strip metadata from issue description for portal display
 * 
 * Uses EXACT SAME APPROACH as stripExternalPrefix() for consistency
 * 
 * Metadata footer format (SINGLE LINE):
 * [Portal Metadata] User: User Name email@example.com Time: Jan 1, 2025, 10:30 AM GMT+7
 * 
 * Legacy multi-line format (for backward compatibility):
 * [Portal Metadata]
 * User: User Name email@example.com
 * Time: Jan 1, 2025, 10:30 AM
 * 
 * @param description - Issue description text
 * @returns Clean description without metadata footer
 */
export function stripMetadataFromDescription(description: string): string {
  if (!description) return '';
  
  // CRITICAL: Use EXACT SAME normalization as stripExternalPrefix()
  // 1. Remove ALL backslashes first (handles escaped brackets)
  // 2. Trim all whitespace
  // 3. Remove BOM and special characters
  const normalized = description
    .replaceAll('\\', '')                 // Remove ALL backslashes (unescapes \\[ and \\])
    .trim()                           // Remove whitespace
    .replace(/^\uFEFF/, '');          // Remove BOM if present
  
  let cleaned = normalized;
  
  // CRITICAL: Strip SINGLE-LINE metadata format (most common now)
  // Pattern: [Portal Metadata] User: ... Time: ...
  // Must match complete metadata including email and timezone
  // Example: [Portal Metadata] User: David Hoang david.t@teifi.com Time: Oct 18, 2025, 10:33 PM GMT+7
  // EXACT SAME REGEX as stripExternalPrefix()
  const singleLineMetadataRegex = /\s*\[Portal Metadata\]\s*User:.*Time:.*$/gim;
  cleaned = cleaned.replace(singleLineMetadataRegex, '').trim();
  
  // Strip MULTI-LINE metadata footer if present (legacy format)
  // Format: \n\n[Portal Metadata]\nUser: ...\nTime: ...
  // Try both double newline and single newline versions
  let metadataSeparatorIndex = cleaned.indexOf('\n\n[Portal Metadata]');
  if (metadataSeparatorIndex === -1) {
    metadataSeparatorIndex = cleaned.indexOf('\n[Portal Metadata]');
  }
  
  if (metadataSeparatorIndex !== -1) {
    cleaned = cleaned.substring(0, metadataSeparatorIndex).trim();
  }
  
  // LEGACY FORMAT: \n---\nPosted by: ...
  const legacyMetadataSeparatorIndex = cleaned.indexOf('\n---\nPosted by:');
  if (legacyMetadataSeparatorIndex !== -1) {
    cleaned = cleaned.substring(0, legacyMetadataSeparatorIndex).trim();
  }
  
  return cleaned;
}

/**
 * Extract Portal Metadata from comment/description body
 * 
 * Parses Portal Metadata to extract actual portal user info instead of Linear API user.
 * Since we use a single shared Linear API key, comment.user will always be the API key owner.
 * The REAL user who posted from the portal is in the metadata.
 * 
 * Formats supported:
 * SINGLE-LINE: [Portal Metadata] User: David Hoang david@email.com Time: Nov 6, 2025, 04:32 PM GMT+7
 * MULTI-LINE:  [Portal Metadata]\nUser: David Hoang david@email.com\nTime: Nov 6, 2025, 04:32 PM GMT+7
 * 
 * @param body - Comment or description text with metadata
 * @returns Object with user name, email, timestamp, and initials for avatar
 */
export interface PortalMetadata {
  userName: string;
  userEmail: string;
  timestamp: string;
  userInitials: string;
}

export function extractPortalMetadata(body: string): PortalMetadata | null {
  if (!body) return null;
  
  console.log('[extractPortalMetadata] Processing body:', body.substring(0, 200));
  
  // Try SINGLE-LINE format first (most common)
  // Example: [Portal Metadata] User: David Hoang hoangtuan...@gmail.com Time: Nov 6, 2025, 04:32 PM GMT+7
  const singleLineMatch = body.match(
    /\[Portal Metadata\]\s*User:\s*([^0-9]+?)\s+([\w.+-]+@[\w.-]+)\s*Time:\s*(.+?)(?:\s*$|\n)/i
  );
  
  if (singleLineMatch) {
    const userName = singleLineMatch[1].trim();
    const userEmail = singleLineMatch[2].trim();
    const timestamp = singleLineMatch[3].trim();
    
    console.log('[extractPortalMetadata] SINGLE-LINE match:', { userName, userEmail, timestamp });
    
    // Generate initials from name (e.g., "David Hoang" -> "DH")
    const userInitials = userName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    return {
      userName,
      userEmail,
      timestamp,
      userInitials
    };
  }
  
  // Try MULTI-LINE format (legacy)
  // Example:
  // [Portal Metadata]
  // User: David Hoang david@email.com
  // Time: Nov 6, 2025, 04:32 PM GMT+7
  const multiLineUserMatch = body.match(/\[Portal Metadata\][\s\S]*?User:\s*([^0-9]+?)\s+([\w.+-]+@[\w.-]+)/i);
  const multiLineTimeMatch = body.match(/Time:\s*(.+?)(?:\s*$|\n)/i);
  
  if (multiLineUserMatch && multiLineTimeMatch) {
    const userName = multiLineUserMatch[1].trim();
    const userEmail = multiLineUserMatch[2].trim();
    const timestamp = multiLineTimeMatch[1].trim();
    
    console.log('[extractPortalMetadata] MULTI-LINE match:', { userName, userEmail, timestamp });
    
    const userInitials = userName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    
    return {
      userName,
      userEmail,
      timestamp,
      userInitials
    };
  }
  
  console.log('[extractPortalMetadata] NO MATCH - returning null');
  return null;
}