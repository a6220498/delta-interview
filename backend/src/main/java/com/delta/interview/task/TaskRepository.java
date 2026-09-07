package com.delta.interview.task;

import com.delta.interview.api.model.Task;
import com.delta.interview.api.model.TaskCategory;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Repository;

/**
 * In-memory store for tasks, backing the scaffold until a real datastore lands.
 *
 * <p>Stores the generated {@link Task} model directly instead of a separate
 * domain entity plus mapper. With no persistence layer there is nothing for a
 * second representation to decouple us from, and an unused mapping layer is the
 * kind of speculative abstraction the project rules forbid. The moment a real
 * datastore arrives, introduce a persistence entity here and map at this
 * boundary — the controller and the contract stay untouched.
 *
 * <p>Backed by a {@link ConcurrentHashMap} because Spring serves requests from a
 * thread pool; a plain {@code HashMap} would corrupt under concurrent writes.
 */
@Repository
public class TaskRepository {

    private final Map<UUID, Task> tasksById = new ConcurrentHashMap<>();
    // [AI assisted 003] 使用 AI 協助設計「每個 category 一個獨立計數器」的發號機制，
    // 並確認 EnumMap（建構時填滿、之後只讀）+ AtomicInteger 在 Spring 執行緒池下的安全性。
    private final Map<TaskCategory, AtomicInteger> sequencesByCategory = newSequenceCounters();
    private final Clock clock;

    /**
     * @param clock - source of creation/update timestamps; injected so tests can
     *     pin time instead of asserting against {@code now()}.
     */
    public TaskRepository(Clock clock) {
        this.clock = clock;
    }

    /**
     * Lists tasks, newest first, optionally narrowed to one completion state.
     *
     * @param completed - {@code null} for every task, otherwise the state to keep.
     * @return a newly built list; callers may not mutate the stored tasks through it.
     */
    public List<Task> findAll(Boolean completed) {
        return tasksById.values().stream()
                .filter(task -> completed == null || completed.equals(task.getCompleted()))
                .sorted(Comparator.comparing(Task::getCreatedAt).reversed())
                .toList();
    }

    /**
     * Fetches one task.
     *
     * @param id - the task to fetch.
     * @return the stored task.
     * @throws TaskNotFoundException when no task has that id.
     */
    public Task findById(UUID id) {
        Task task = tasksById.get(id);
        if (task == null) {
            throw new TaskNotFoundException(id);
        }
        return task;
    }

    /**
     * Stores a new task with a server-assigned id, serial and timestamps.
     *
     * <p>The id, serial and timestamps are assigned here rather than accepted
     * from the request: a client-chosen id could overwrite an existing task, and
     * a client-chosen serial could duplicate a number already on someone's screen.
     *
     * @param title - the task title, already validated by the contract.
     * @param description - optional detail; may be {@code null}.
     * @param category - which counter the serial is drawn from.
     * @param dueDate - optional due date; may be {@code null}.
     * @return the stored task.
     */
    public Task create(String title, String description, TaskCategory category, LocalDate dueDate) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        Task task = new Task(UUID.randomUUID(), category, nextSequence(category), title, false, now, now)
                .description(description)
                .dueDate(dueDate);
        tasksById.put(task.getId(), task);
        return task;
    }

    /**
     * Replaces a task's editable fields, leaving its completion state alone.
     *
     * <p>Moving a task to the other category re-issues its serial from the
     * destination's counter, because the two counters run independently and a
     * carried-over serial could collide with a number already in use there. The
     * task's {@code id} is untouched, so the move costs nothing that a URL or an
     * in-flight request depends on. The vacated serial is simply burned.
     *
     * @param id - the task to update.
     * @param title - the replacement title.
     * @param description - the replacement detail; {@code null} clears it.
     * @param category - the destination category; unchanged keeps the serial.
     * @param dueDate - the replacement due date; {@code null} clears it.
     * @return the updated task.
     * @throws TaskNotFoundException when no task has that id.
     */
    public Task update(UUID id, String title, String description, TaskCategory category, LocalDate dueDate) {
        return mutate(id, task -> {
            // [AI assisted 003] 由 AI 協助把「該不該重新發號」的判斷放進
            // computeIfPresent 的原子區段內，避免讀舊類別與寫新號碼之間出現空隙。
            // Read before the field is overwritten: whether this is a move is the
            // only thing that decides between keeping and re-issuing the serial.
            int sequence = category == task.getCategory() ? task.getSequence() : nextSequence(category);
            return task.title(title)
                    .description(description)
                    .category(category)
                    .sequence(sequence)
                    .dueDate(dueDate);
        });
    }

    /**
     * Sets a task's completion state to an explicit value.
     *
     * @param id - the task to change.
     * @param completed - the target state; idempotent, so re-sending the current
     *     state is a no-op rather than a toggle.
     * @return the updated task.
     * @throws TaskNotFoundException when no task has that id.
     */
    public Task setCompletion(UUID id, boolean completed) {
        return mutate(id, task -> task.completed(completed));
    }

    /**
     * Removes a task.
     *
     * @param id - the task to delete.
     * @throws TaskNotFoundException when no task has that id, so a repeated
     *     delete reports 404 rather than pretending to succeed.
     */
    public void delete(UUID id) {
        if (tasksById.remove(id) == null) {
            throw new TaskNotFoundException(id);
        }
    }

    /**
     * Applies a change to a stored task and stamps {@code updatedAt}.
     *
     * @param id - the task to change.
     * @param change - the field mutation to apply.
     * @return the updated task.
     * @throws TaskNotFoundException when no task has that id.
     */
    private Task mutate(UUID id, java.util.function.UnaryOperator<Task> change) {
        Task updated = tasksById.computeIfPresent(
                id, (key, task) -> change.apply(task).updatedAt(OffsetDateTime.now(clock)));
        if (updated == null) {
            throw new TaskNotFoundException(id);
        }
        return updated;
    }

    /**
     * Draws the next serial for one category.
     *
     * @param category - the counter to advance.
     * @return the new serial; the first task in a category gets 1.
     */
    private int nextSequence(TaskCategory category) {
        return sequencesByCategory.get(category).incrementAndGet();
    }

    /**
     * Builds one independent counter per category, all starting at zero.
     *
     * <p>The contract makes the pair (category, serial) unique rather than the
     * serial alone, so each category needs its own counter — sharing one would
     * leave visible gaps in both numbering runs.
     *
     * <p>Filled in completely here and never structurally modified afterwards,
     * so the unsynchronised {@link EnumMap} is only ever read concurrently while
     * the counting itself happens inside {@link AtomicInteger}. Adding a
     * category later means adding an enum constant; this picks it up for free.
     *
     * @return a counter for every declared category.
     */
    private static Map<TaskCategory, AtomicInteger> newSequenceCounters() {
        Map<TaskCategory, AtomicInteger> counters = new EnumMap<>(TaskCategory.class);
        for (TaskCategory category : TaskCategory.values()) {
            counters.put(category, new AtomicInteger());
        }
        return counters;
    }
}
