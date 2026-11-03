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
