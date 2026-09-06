package com.delta.interview.task;

import java.util.UUID;

/**
 * Raised when an operation targets a task id that does not exist.
 *
 * <p>Thrown from the repository rather than returned as an empty {@code Optional}
 * so that every one of the four id-addressed operations gets the contract's 404
 * from a single {@code @ExceptionHandler}, instead of each re-implementing the
 * same not-found branch.
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
