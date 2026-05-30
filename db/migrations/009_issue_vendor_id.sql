-- Add optional vendor_id FK to issue.issues so vendor detail pages can
-- load real associated findings without heuristic source-based filtering.
ALTER TABLE issue.issues
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ON issue.issues (vendor_id) WHERE vendor_id IS NOT NULL;
