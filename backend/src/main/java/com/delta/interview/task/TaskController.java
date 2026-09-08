package com.delta.interview.task;

import com.delta.interview.api.TasksApi;
import com.delta.interview.api.model.CreateTaskRequest;
import com.delta.interview.api.model.Task;
import com.delta.interview.api.model.TaskCompletionRequest;
import com.delta.interview.api.model.TaskSummary;
import com.delta.interview.api.model.UpdateTaskRequest;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the task operations declared in {@code api/openapi.yaml}.
 *
 * <p>Carries no {@code @RequestMapping} of its own: every route, status code and
 * validation constraint is inherited from the generated {@link TasksApi}
 * interface, so the contract cannot drift from the running server. The generator
 * runs with {@code skipDefaultInterface=true}, which means removing an operation
 * from this class breaks the build instead of silently serving 501.
 */
@RestController
public class TaskController implements TasksApi {

    private final TaskRepository tasks;

    public TaskController(TaskRepository tasks) {
        this.tasks = tasks;
    }

    @Override
    public ResponseEntity<List<TaskSummary>> listTasks(@Nullable Boolean completed) {
        return ResponseEntity.ok(
                tasks.findAll(completed).stream().map(TaskController::summarise).toList());
    }

    @Override
    public ResponseEntity<Task> getTask(UUID id) {
        return ResponseEntity.ok(tasks.findById(id));
    }

    // [AI assisted 003] 使用 AI 協助把契約新增的 category / dueDate 接進 repository 呼叫
    @Override
    public ResponseEntity<Task> createTask(CreateTaskRequest createTaskRequest) {
        Task created = tasks.create(
                createTaskRequest.getTitle(),
                createTaskRequest.getDescription(),
                createTaskRequest.getCategory(),
                createTaskRequest.getDueDate());
        return ResponseEntity.created(URI.create("/api/tasks/" + created.getId())).body(created);
    }

    // [AI assisted 003] 同上；改類別的發號邏輯刻意留在 repository，controller 只轉交欄位
    @Override
    public ResponseEntity<Task> updateTask(UUID id, UpdateTaskRequest updateTaskRequest) {
        return ResponseEntity.ok(tasks.update(
                id,
                updateTaskRequest.getTitle(),
                updateTaskRequest.getDescription(),
                updateTaskRequest.getCategory(),
                updateTaskRequest.getDueDate()));
    }

    @Override
    public ResponseEntity<Task> setTaskCompletion(UUID id, TaskCompletionRequest taskCompletionRequest) {
        return ResponseEntity.ok(tasks.setCompletion(id, taskCompletionRequest.getCompleted()));
    }

    @Override
    public ResponseEntity<Void> deleteTask(UUID id) {
        tasks.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Narrows a stored task to the fields the board's shelves are drawn from.
     *
     * <p>Mapped here rather than in the repository: which fields a response
     * carries is a contract decision, while the repository's job is to hold
     * whole tasks — a store that only ever handed back summaries would have
     * nothing left to answer {@code GET /api/tasks/{id}} with.
     *
     * <p>Copied field by field rather than by a mapping library, because there
     * is exactly one mapping in this application and a library to perform it
     * would be more machinery than the six lines it replaces. A field the
     * contract later makes required arrives in the constructor and stops this
     * line compiling, which is the point at which someone decides whether the
     * board needs it.
     *
     * @param task - the stored task, detail and all.
     * @return the same task without its description.
     */
    private static TaskSummary summarise(Task task) {
        return new TaskSummary(
                        task.getId(),
                        task.getCategory(),
                        task.getSequence(),
                        task.getTitle(),
                        task.getCompleted(),
                        task.getCreatedAt(),
                        task.getUpdatedAt())
                .dueDate(task.getDueDate());
    }
}
