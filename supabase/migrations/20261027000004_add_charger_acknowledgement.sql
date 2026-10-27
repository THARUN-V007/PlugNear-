-- ============================================================================
-- PlugNear: Add Regulatory Electricity Permission Acknowledgement Column
-- Version: 20261027000004
-- Description:
--   1. Adds electricity_permission_acknowledged boolean column to public.chargers.
--   2. Sets existing seeded chargers to true so existing demo chargers remain valid.
--   3. Required to be true for creating, editing, or reactivating any charger.
-- ============================================================================

-- 1. Add column to public.chargers
ALTER TABLE public.chargers
  ADD COLUMN IF NOT EXISTS electricity_permission_acknowledged boolean NOT NULL DEFAULT false;

-- 2. Backfill existing rows so active seeded chargers remain valid
UPDATE public.chargers
SET electricity_permission_acknowledged = true
WHERE electricity_permission_acknowledged = false;
