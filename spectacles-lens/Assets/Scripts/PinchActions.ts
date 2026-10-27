/**
 * `action` values for the `pinchCommand` envelope.
 * Mirrors `PinchAction` in backend/contracts.py and the table in docs/spec.md section 3.1 D.
 */
export const PinchAction = {
  ADD_NODE: 'ADD_NODE',
  CONNECT_NODES: 'CONNECT_NODES',
  ASK_AGENT: 'ASK_AGENT',
  CONCLUDE_MEETING: 'CONCLUDE_MEETING',
  CALIBRATE_AREA: 'CALIBRATE_AREA',
  INGEST_DRAWING: 'INGEST_DRAWING',
  UPDATE_SNAPSHOT: 'UPDATE_SNAPSHOT'
} as const;

export type PinchActionName = typeof PinchAction[keyof typeof PinchAction];
