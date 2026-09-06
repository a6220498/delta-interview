package com.delta.interview.common;

import com.delta.interview.task.TaskNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates domain exceptions into the {@code Problem} shape declared in the contract.
 *
 * <p>Bean-validation and malformed-body failures are deliberately not handled
 * here: {@code spring.mvc.problemdetails.enabled} already renders those as
 * RFC 9457 problem details, and duplicating that logic would let the two
 * representations drift apart.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Maps a missing task to the contract's 404 response.
     *
     * @param exception - the not-found signal raised by the repository.
     * @return a problem detail carrying the offending id in {@code detail}.
     */
    @ExceptionHandler(TaskNotFoundException.class)
    public ProblemDetail handleTaskNotFound(TaskNotFoundException exception) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        problem.setTitle("Task not found");
        problem.setDetail(exception.getMessage());
        return problem;
    }
}
