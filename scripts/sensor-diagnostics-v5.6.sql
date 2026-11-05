-- v5.6.0 diagnostic metadata: additive, zero data deletion.
-- Run against Barangay Talon Neon database only; existing records remain intact.
ALTER TABLE solar_device_health
 ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'UNKNOWN',
 ADD COLUMN IF NOT EXISTS voltage_status TEXT NOT NULL DEFAULT 'UNKNOWN',
 ADD COLUMN IF NOT EXISTS supply_mode TEXT NOT NULL DEFAULT 'UNVERIFIED',
 ADD COLUMN IF NOT EXISTS low_current_estimate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE solar_status_history
 ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'UNKNOWN',
 ADD COLUMN IF NOT EXISTS voltage_status TEXT NOT NULL DEFAULT 'UNKNOWN',
 ADD COLUMN IF NOT EXISTS supply_mode TEXT NOT NULL DEFAULT 'UNVERIFIED',
 ADD COLUMN IF NOT EXISTS low_current_estimate BOOLEAN NOT NULL DEFAULT FALSE;
