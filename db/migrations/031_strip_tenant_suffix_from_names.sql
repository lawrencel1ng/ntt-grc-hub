-- Migration 031: Strip internal tenant-ID suffixes from vendor and connector names.
-- Seeded names were "VendorName — t_tenantid"; strip " — t_..." to get clean names.

UPDATE vendor.vendors
SET name = regexp_replace(name, '\s+—\s+t_\S+$', '')
WHERE name ~ '\s+—\s+t_\S+$';

UPDATE integration.connectors
SET name = regexp_replace(name, '\s+—\s+t_\S+$', '')
WHERE name ~ '\s+—\s+t_\S+$';
