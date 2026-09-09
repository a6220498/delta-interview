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
 * In-memory store for tasks, holding the generated {@link Task} model directly since
 * there is no persistence layer yet. {@link ConcurrentHashMap}: Spring uses a pool.
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
     * Stores a new task with a server-assigned id, serial and timestamps. Assigned here
     * rather than accepted: a client-chosen id or serial could collide with a stored one.
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
     * Replaces a task's editable fields, leaving completion alone. A move to the other
     * category re-issues the serial, since the counters run independently.
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
            // [AI assisted 003] 「該不該重新發號」的判斷放進 computeIfPresent 的原子區段
            // 內，避免讀舊類別與寫新號碼之間出現空隙。必須在欄位被覆寫前先讀。
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
     * Builds one independent counter per category: the contract makes (category, serial)
     * unique, and the {@link EnumMap} is filled here then only ever read.
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
