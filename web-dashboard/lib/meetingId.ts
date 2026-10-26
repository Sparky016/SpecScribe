// Meeting IDs are interpolated into backend URL paths, so only UUIDs and the demo IDs are accepted.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_MEETING_IDS = new Set(["demo", "demo-session-01"]);

export function isValidMeetingId(id: string): boolean {
  return UUID_PATTERN.test(id) || DEMO_MEETING_IDS.has(id);
}
