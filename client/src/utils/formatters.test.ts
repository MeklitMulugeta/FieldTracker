import { describe, expect, it } from 'vitest';
import {
  formatCategoryLabel,
  formatSeverityLabel,
  formatStatusLabel,
  formatSyncLabel,
} from './formatters';

describe('formatters', () => {
  it('formats status labels cleanly', () => {
    expect(formatStatusLabel('draft')).toBe('Draft');
    expect(formatStatusLabel('open')).toBe('Open');
    expect(formatStatusLabel('in_progress')).toBe('In Progress');
    expect(formatStatusLabel('resolved')).toBe('Resolved');
  });

  it('formats severity, sync, and category labels', () => {
    expect(formatSeverityLabel('critical')).toBe('Critical');
    expect(formatSyncLabel('pending_sync')).toBe('Pending Sync');
    expect(formatCategoryLabel('safety')).toBe('Safety Hazard');
  });
});
