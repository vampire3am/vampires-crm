export class SupabaseAttendanceSink {
  constructor(config) {
    this.baseUrl = config.supabaseUrl.replace(/\/$/, "");
    this.serviceRoleKey = config.supabaseServiceRoleKey;
    this.deviceSerial = config.deviceSerial;
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers);
    headers.set("apikey", this.serviceRoleKey);
    headers.set("Authorization", `Bearer ${this.serviceRoleKey}`);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, { ...options, headers });
    if (!response.ok) throw new Error(`Supabase request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 700)}`);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async device() {
    const serial = encodeURIComponent(this.deviceSerial);
    const rows = await this.request(`hr_attendance_devices?serial_number=eq.${serial}&select=*`);
    if (!rows?.length) throw new Error(`Device ${this.deviceSerial} is not registered. Run the Hikvision attendance migration first.`);
    return rows[0];
  }

  async markAttempt(fields = {}) {
    const serial = encodeURIComponent(this.deviceSerial);
    await this.request(`hr_attendance_devices?serial_number=eq.${serial}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }),
    });
  }

  ingest(event) {
    return this.request("rpc/hr_ingest_hikvision_punch", {
      method: "POST",
      body: JSON.stringify({
        p_device_serial: this.deviceSerial,
        p_event_uid: event.eventUid,
        p_device_user_id: event.deviceUserId,
        p_occurred_at: event.occurredAt,
        p_event_kind: event.eventKind,
        p_authentication_mode: event.authenticationMode,
        p_attendance_status: event.attendanceStatus,
        p_raw_payload: event.raw,
      }),
    });
  }
}
