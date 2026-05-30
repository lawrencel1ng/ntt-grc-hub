-- Migration 007: add employee_count to vendor.vendors
-- Allows replacing synthetic RNG employee figures with real data.

ALTER TABLE vendor.vendors
  ADD COLUMN IF NOT EXISTS employee_count INT;
