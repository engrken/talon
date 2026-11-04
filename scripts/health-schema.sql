
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
