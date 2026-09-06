package com.delta.interview.task;

import com.delta.interview.api.model.Task;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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
     * Stores a new task with a server-assigned id and timestamps.
     *
     * <p>The id and timestamps are assigned here rather than accepted from the
     * request so a client cannot overwrite an existing task by choosing its id.
     *
     * @param title - the task title, already validated by the contract.
     * @param description - optional detail; may be {@code null}.
     * @return the stored task.
     */
    public Task create(String title, String description) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        Task task = new Task(UUID.randomUUID(), title, false, now, now).description(description);
        tasksById.put(task.getId(), task);
        return task;
    }

    /**
     * Replaces a task's editable fields, leaving its completion state alone.
     *
     * @param id - the task to update.
     * @param title - the replacement title.
     * @param description - the replacement detail; {@code null} clears it.
     * @return the updated task.
     * @throws TaskNotFoundException when no task has that id.
     */
    public Task update(UUID id, String title, String description) {
        return mutate(id, task -> task.title(title).description(description));
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
}
