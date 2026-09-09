import type { TaskRack } from '@/const/task'

/**
 * Inputs for the phone board's shelf switch. Counts rather than tasks: the switch
 * prints how many are on each shelf and has no use for the rows themselves.
 */
export interface RackSwitchProps {
  /** The shelves to offer, in board order. */
  racks: readonly TaskRack[]
  /** How many tasks each shelf holds, keyed by `TaskRack.id`. */
  counts: Readonly<Record<string, number>>
  /** The shelf on screen, by id. Which one that is belongs to the board, not here. */
  modelValue: string
}

/** What the switch reports. */
export interface RackSwitchEmits {
  /** A segment was pressed, carrying its rack id — the board's half of `v-model`. */
  'update:modelValue': [rackId: string]
}
