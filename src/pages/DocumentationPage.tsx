import { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { BookOpen, Users, Shield, Code } from 'lucide-react';
import { usePermissions } from '../contexts/PermissionContext';
import { useSearchParams } from 'react-router-dom';
import { CLIENT_UAT_WORKFLOW, SUPERADMIN_INITIALIZATION, DEVELOPMENT_GUIDELINES } from '../utils/documentationContent';

export function DocumentationPage() {
  const { userRole } = usePermissions();
  const [searchParams] = useSearchParams();
  const docParam = searchParams.get('doc');
  
  // Determine initial tab based on URL parameter or default
  const getInitialTab = () => {
    if (docParam === 'client-uat-workflow') return 'user';
    if (docParam === 'superadmin-init') return 'admin';
    if (docParam === 'guidelines') return 'dev';
    return 'user';
  };
  
  const [activeTab, setActiveTab] = useState<'user' | 'admin' | 'dev'>(getInitialTab());

  // Update tab when URL parameter changes
  useEffect(() => {
    if (docParam === 'client-uat-workflow') setActiveTab('user');
    else if (docParam === 'superadmin-init') setActiveTab('admin');
    else if (docParam === 'guidelines') setActiveTab('dev');
  }, [docParam]);

  const isAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'client_manager';

  const getContent = () => {
    if (activeTab === 'user') return CLIENT_UAT_WORKFLOW;
    if (activeTab === 'admin') return SUPERADMIN_INITIALIZATION;
    return DEVELOPMENT_GUIDELINES;
  };

  const currentContent = getContent();

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start gap-3">
        <BookOpen className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
        <div>
          <h1 className="!mb-1">Documentation</h1>
          <p className="text-muted-foreground">
            Comprehensive guides and reference materials
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'user' | 'admin' | 'dev')} className="w-full">
        <TabsList>
          <TabsTrigger value="user" className="gap-2">
            <Users className="h-4 w-4" />
            User Guides
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="h-4 w-4" />
              Admin Guides
            </TabsTrigger>
          )}
          <TabsTrigger value="dev" className="gap-2">
            <Code className="h-4 w-4" />
            Developer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="mt-6">
          <Card className="p-8">
            <MarkdownRenderer content={currentContent} />
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <Card className="p-8">
              <MarkdownRenderer content={currentContent} />
            </Card>
          </TabsContent>
        )}
        
        <TabsContent value="dev" className="mt-6">
          <Card className="p-8">
            <MarkdownRenderer content={currentContent} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        
        elements.push(
          <pre key={`code-${elements.length}`} className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 border border-border">
            <code className="text-sm font-mono block whitespace-pre">
              {codeLines.join('\n')}
            </code>
          </pre>
        );
        i++;
        continue;
      }
      
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${elements.length}`} className="!text-3xl !font-bold !mb-4 !mt-0">
            {trimmed.slice(2)}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${elements.length}`} className="!text-2xl !font-semibold !mb-3 !mt-8 pb-2 border-b border-border">
            {trimmed.slice(3)}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${elements.length}`} className="!text-xl !font-semibold !mb-2 !mt-6">
            {trimmed.slice(4)}
          </h3>
        );
      } else if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={`h4-${elements.length}`} className="!text-lg !font-semibold !mb-2 !mt-4">
            {trimmed.slice(5)}
          </h4>
        );
      }
      else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={`quote-${elements.length}`} className="border-l-4 border-primary pl-4 py-2 my-4 italic bg-muted/50 rounded-r">
            {processInline(trimmed.slice(2))}
          </blockquote>
        );
      }
      else if (trimmed === '---') {
        elements.push(
          <hr key={`hr-${elements.length}`} className="my-8 border-border" />
        );
      }
      else if (trimmed.match(/^[-*]\s+/)) {
        const listItems: string[] = [];
        
        while (i < lines.length && lines[i].trim().match(/^[-*]\s+/)) {
          listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
          i++;
        }
        
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc ml-6 mb-4 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-7">
                {processInline(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }
      else if (trimmed.match(/^\d+\.\s+/)) {
        const listItems: string[] = [];
        
        while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal ml-6 mb-4 space-y-1">
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-7">
                {processInline(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }
      else if (trimmed.startsWith('| ')) {
        const tableRows: string[] = [trimmed];
        i++;
        
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableRows.push(lines[i].trim());
          i++;
        }
        
        if (tableRows.length >= 2) {
          const headers = tableRows[0].split('|').filter(h => h.trim()).map(h => h.trim());
          const rows = tableRows.slice(2).map(row => 
            row.split('|').filter(c => c.trim()).map(c => c.trim())
          );
          
          elements.push(
            <div key={`table-${elements.length}`} className="overflow-x-auto mb-4">
              <table className="min-w-full border border-border rounded-lg">
                <thead className="bg-muted">
                  <tr>
                    {headers.map((header, idx) => (
                      <th key={idx} className="px-4 py-2 text-left border-b border-border">
                        {processInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-border last:border-0">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2">
                          {processInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }
      else if (trimmed === '') {
        // Skip empty lines
      }
      else {
        elements.push(
          <p key={`p-${elements.length}`} className="mb-4 leading-7">
            {processInline(line)}
          </p>
        );
      }
      
      i++;
    }
    
    return elements;
  }, [content]);
  
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      {renderedContent}
    </div>
  );
}

function processInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(processFormatting(remaining.slice(0, codeMatch.index), key++));
      }
      parts.push(
        <code key={`code-${key++}`} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }
    
    parts.push(processFormatting(remaining, key++));
    break;
  }
  
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function processFormatting(text: string, key: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;
  
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(processItalic(remaining.slice(0, boldMatch.index), `${key}-${partKey++}`));
      }
      parts.push(
        <strong key={`${key}-bold-${partKey++}`}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    
    parts.push(processItalic(remaining, `${key}-${partKey++}`));
    break;
  }
  
  return parts.length === 1 ? parts[0] : <span key={key}>{parts}</span>;
}

function processItalic(text: string, key: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;
  
  while (remaining.length > 0) {
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(processLinks(remaining.slice(0, italicMatch.index), `${key}-${partKey++}`));
      }
      parts.push(
        <em key={`${key}-italic-${partKey++}`} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }
    
    parts.push(processLinks(remaining, `${key}-${partKey++}`));
    break;
  }
  
  return parts.length === 1 ? parts[0] : <span key={key}>{parts}</span>;
}

function processLinks(text: string, key: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;
  
  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(remaining.slice(0, linkMatch.index));
      }
      parts.push(
        <a 
          key={`${key}-link-${partKey++}`}
          href={linkMatch[2]} 
          className="text-primary hover:underline"
          target={linkMatch[2].startsWith('http') ? '_blank' : undefined}
          rel={linkMatch[2].startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }
    
    parts.push(remaining);
    break;
  }
  
  return parts.length === 1 ? parts[0] : <span key={key}>{parts}</span>;
}