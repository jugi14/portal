import React from 'react';
import { Card, CardContent } from '../ui/card';
import { EditableDescription } from './EditableDescription';

interface IssueDescriptionProps {
  description: string | null | undefined;
  issueId: string;
  onUpdate?: (newDescription: string) => void;
}

export function IssueDescription({ description, issueId, onUpdate }: IssueDescriptionProps) {
  return <EditableDescription description={description} issueId={issueId} onUpdate={onUpdate} />;
}