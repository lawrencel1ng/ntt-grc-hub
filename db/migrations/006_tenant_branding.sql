-- Add branding support to platform.tenants
ALTER TABLE platform.tenants
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#6d28d9';
