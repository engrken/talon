-- Run only on the NEW Barangay Talon database. Do not point this at CLEAR/CircuitByte.
CREATE TABLE IF NOT EXISTS solar_devices (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  token_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ,
  last_status TEXT
);
CREATE TABLE IF NOT EXISTS solar_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES solar_devices(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  boot_id TEXT NOT NULL,
  seq BIGINT NOT NULL,
  volts DOUBLE PRECISION NOT NULL,
  amps DOUBLE PRECISION NOT NULL,
  watts DOUBLE PRECISION NOT NULL,
  energy_wh DOUBLE PRECISION NOT NULL,
  delta_wh DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  UNIQUE (device_id,boot_id,seq)
);
CREATE INDEX IF NOT EXISTS solar_readings_received_idx ON solar_readings(device_id,received_at DESC);
CREATE TABLE IF NOT EXISTS solar_rates (
  billing_month TEXT PRIMARY KEY CHECK (billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  php_per_kwh NUMERIC(10,4) NOT NULL CHECK (php_per_kwh>=0 AND php_per_kwh<=100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS solar_email_reports (
  report_date DATE PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_id TEXT
);


-- Additive health migration for Talon only. Existing readings and credentials are unchanged.
CREATE TABLE IF NOT EXISTS solar_device_health (
 device_id TEXT PRIMARY KEY REFERENCES solar_devices(id) ON DELETE CASCADE,
 seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), boot_id TEXT NOT NULL, seq BIGINT NOT NULL,
 firmware TEXT NOT NULL, uptime_seconds BIGINT NOT NULL, free_heap_bytes BIGINT NOT NULL,
 wifi_connected BOOLEAN NOT NULL, wifi_rssi_dbm INTEGER NOT NULL,
 lcd_initialized BOOLEAN NOT NULL, sensor_verified BOOLEAN NOT NULL, supply_present BOOLEAN NOT NULL,
 sensor_fault TEXT NOT NULL, station_status TEXT NOT NULL, cloud_last_result TEXT NOT NULL,
 usb_modules_total INTEGER NOT NULL DEFAULT 4, usb_ports_total INTEGER NOT NULL DEFAULT 8,
 usb_monitoring TEXT NOT NULL DEFAULT 'UNMONITORED'
);
CREATE TABLE IF NOT EXISTS solar_status_history (
 id BIGSERIAL PRIMARY KEY, device_id TEXT NOT NULL REFERENCES solar_devices(id) ON DELETE CASCADE,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), boot_id TEXT NOT NULL, seq BIGINT NOT NULL,
 firmware TEXT NOT NULL, uptime_seconds BIGINT NOT NULL, wifi_rssi_dbm INTEGER NOT NULL,
 lcd_initialized BOOLEAN NOT NULL, sensor_verified BOOLEAN NOT NULL, supply_present BOOLEAN NOT NULL,
 sensor_fault TEXT NOT NULL, station_status TEXT NOT NULL, cloud_last_result TEXT NOT NULL,
 event_type TEXT NOT NULL, UNIQUE(device_id,boot_id,seq)
);
CREATE INDEX IF NOT EXISTS solar_status_history_device_time_idx ON solar_status_history(device_id,id DESC);

-- v5.6.0 independent sensor and 5V experimental mode diagnostics.
-- Additive migration: run these on an EXISTING Talon database if needed.
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

-- v5.7.0 optional ACS supply telemetry and authenticated, read-only remote diagnostics.
ALTER TABLE solar_device_health
 ADD COLUMN IF NOT EXISTS acs_vcc_monitor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS acs_vcc_healthy BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS acs_vcc_v DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE solar_status_history
 ADD COLUMN IF NOT EXISTS acs_vcc_monitor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS acs_vcc_healthy BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS acs_vcc_v DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS solar_remote_commands (
 id BIGSERIAL PRIMARY KEY,
 device_id TEXT NOT NULL REFERENCES solar_devices(id) ON DELETE CASCADE,
 command TEXT NOT NULL CHECK (command IN ('h','d')),
 state TEXT NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED','CLAIMED','DONE','EXPIRED')),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '3 minutes'),
 claimed_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 output TEXT
);
CREATE INDEX IF NOT EXISTS solar_remote_cmd_device_idx ON solar_remote_commands(device_id,id DESC);
