package com.delta.interview.task;

import java.util.UUID;

/**
 * Raised when an operation targets a task id that does not exist. Thrown rather than
 * returned as an empty {@code Optional}, so one {@code @ExceptionHandler} serves all four.
 */
public class TaskNotFoundException extends RuntimeException {

    private final UUID id;

    public TaskNotFoundException(UUID id) {
        super("No task exists with id " + id + ".");
        this.id = id;
    }

    public UUID getId() {
        return id;
    }
}
