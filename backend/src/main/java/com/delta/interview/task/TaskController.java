package com.delta.interview.task;

import com.delta.interview.api.TasksApi;
import com.delta.interview.api.model.CreateTaskRequest;
import com.delta.interview.api.model.Task;
import com.delta.interview.api.model.TaskCompletionRequest;
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
    public ResponseEntity<List<Task>> listTasks(@Nullable Boolean completed) {
        return ResponseEntity.ok(tasks.findAll(completed));
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
}
