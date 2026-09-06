package com.delta.interview.task;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Verifies the five task operations against the contract's promises: status
 * codes, filtering semantics, and the guarantee that completion state and
 * editable fields are owned by different endpoints.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Task API")
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** Creates a task through the API and returns its id. */
    private UUID createTask(String title) throws Exception {
        String body = mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode created = objectMapper.readTree(body);
        return UUID.fromString(created.get("id").asText());
    }

    @Nested
    @DisplayName("建立任務 (create)")
    class Create {

        @Test
        @DisplayName("returns 201 with a server-assigned id and an incomplete task")
        void createsIncompleteTask() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Write tests\",\"description\":\"Cover the contract\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.title", is("Write tests")))
                    .andExpect(jsonPath("$.description", is("Cover the contract")))
                    // New tasks must start incomplete: the contract gives clients no
                    // way to create an already-completed task.
                    .andExpect(jsonPath("$.completed", is(false)));
        }

        @Test
        @DisplayName("rejects a blank title with 400, because minLength is part of the contract")
        void rejectsBlankTitle() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"\"}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("檢視任務 (read)")
    class Read {

        @Test
        @DisplayName("filters by completion state server-side rather than returning everything")
        void filtersByCompletion() throws Exception {
            UUID done = createTask("already done");
            createTask("still open");
            mockMvc.perform(patch("/api/tasks/{id}/completion", done)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"completed\":true}"))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/tasks").param("completed", "true"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[?(@.id=='" + done + "')]", hasSize(1)))
                    .andExpect(jsonPath("$[?(@.completed==false)]", hasSize(0)));
        }

        @Test
        @DisplayName("returns 404 problem details for an unknown id")
        void unknownIdIsNotFound() throws Exception {
            mockMvc.perform(get("/api/tasks/{id}", UUID.randomUUID()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status", is(404)))
                    .andExpect(jsonPath("$.detail").exists());
        }
    }

    @Nested
    @DisplayName("修改任務 (update)")
    class Update {

        @Test
        @DisplayName("editing a title must not disturb completion state")
        void updateLeavesCompletionAlone() throws Exception {
            UUID id = createTask("original");
            mockMvc.perform(patch("/api/tasks/{id}/completion", id)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"completed\":true}"));

            // This is the whole reason completion lives on its own endpoint: saving
            // an edit form must never silently reopen a finished task.
            mockMvc.perform(put("/api/tasks/{id}", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"renamed\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title", is("renamed")))
                    .andExpect(jsonPath("$.completed", is(true)));
        }
    }

    @Nested
    @DisplayName("標記完成/未完成 (completion)")
    class Completion {

        @Test
        @DisplayName("is idempotent, so a double click cannot flip the task back")
        void isIdempotent() throws Exception {
            UUID id = createTask("submit form");

            for (int attempt = 0; attempt < 2; attempt++) {
                mockMvc.perform(patch("/api/tasks/{id}/completion", id)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"completed\":true}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.completed", is(true)));
            }
        }

        @Test
        @DisplayName("can reopen a completed task")
        void canReopen() throws Exception {
            UUID id = createTask("reopen me");
            mockMvc.perform(patch("/api/tasks/{id}/completion", id)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"completed\":true}"));

            mockMvc.perform(patch("/api/tasks/{id}/completion", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"completed\":false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.completed", is(false)));
        }
    }

    @Nested
    @DisplayName("刪除任務 (delete)")
    class Delete {

        @Test
        @DisplayName("returns 204, then 404 on a repeat so the client learns it is already gone")
        void deleteThenNotFound() throws Exception {
            UUID id = createTask("temporary");

            mockMvc.perform(delete("/api/tasks/{id}", id)).andExpect(status().isNoContent());
            mockMvc.perform(delete("/api/tasks/{id}", id)).andExpect(status().isNotFound());
        }
    }
}
