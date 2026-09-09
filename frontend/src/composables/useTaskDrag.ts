import type { TaskRack } from '@/const/task'
import type { TaskSummary } from '@/types/task'
import { computed, ref } from 'vue'

const inHand = ref<TaskSummary | null>(null)

/**
 * The one docket-dragging gesture the board has in flight, shared by the card that
 * lifts a docket and the trays that can catch it.
 *
 * @returns The docket in hand, and the three things the two ends of the drag do to it.
 */
export function useTaskDrag() {
  /**
   * Takes a docket into the gesture. Both ends of the drag are set up here: what the
   * trays read, and what the browser needs in order to treat the press as a drag.
   *
   * @param task - The row the card being dragged was drawn from.
   * @param transfer - The drag event's `dataTransfer`, or `null` when it carries none.
   */
  function lift(task: TaskSummary, transfer: DataTransfer | null): void {
    inHand.value = task

    // The id filed here is not what the drop reads back — the gesture holds the whole
    // row already. It is set because a drag carrying no data at all never starts in
    // Firefox, and the effect is what gets the pointer a move cursor.
    if (transfer) {
      transfer.effectAllowed = 'move'
      transfer.setData('text/plain', task.id)
    }
  }

  /**
   * Ends the gesture. Driven from `dragend` as well as from a drop, since a drag
   * abandoned mid-air would otherwise leave every tray offering itself for good.
   */
  function release(): void {
    inHand.value = null
  }

  /**
   * Whether `rack` is a shelf the docket in hand could actually move to — which is
   * also whether that tray should light up, since offering a move that is not one lies.
   *
   * @param rack - The shelf asking about the docket being dragged over it.
   * @returns `true` only while a docket the shelf does not already hold is in hand.
   */
  function accepts(rack: TaskRack): boolean {
    return inHand.value !== null && inHand.value.completed !== rack.completed
  }

  return { dragged: computed(() => inHand.value), lift, release, accepts }
}
