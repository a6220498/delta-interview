package com.delta.interview.task;

import static org.assertj.core.api.Assertions.assertThat;
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
 * codes, filtering semantics, per-category serial numbering, and the guarantee
 * that completion state and editable fields are owned by different endpoints.
 *
 * <p>All tests share one application context, so the repository's serial
 * counters carry over between them. Every serial assertion is therefore written
 * against numbers read back within the same test, never against an absolute
 * value like "the first bug is 1" — which would only hold when the test happens
 * to run first.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Task API")
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** Creates a task through the API and returns the created body. */
    private JsonNode create(String requestBody) throws Exception {
        String body = mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }

    /** Creates a feature task (`category` 0) with the given title and returns its id. */
    private UUID createTask(String title) throws Exception {
        return UUID.fromString(
                create("{\"title\":\"" + title + "\",\"category\":0}")
                        .get("id")
                        .asText());
    }

    @Nested
    @DisplayName("建立任務 (create)")
    class Create {

        @Test
        @DisplayName("returns 201 with a server-assigned id and an incomplete task")
        void createsIncompleteTask() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Write tests\",\"category\":0,"
                                    + "\"description\":\"Cover the contract\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").exists())
                    .andExpect(jsonPath("$.title", is("Write tests")))
                    .andExpect(jsonPath("$.description", is("Cover the contract")))
                    .andExpect(jsonPath("$.category", is(0)))
                    // The serial is server-assigned like the id: the payload carries no
                    // sequence, so a client cannot mint a number someone already holds.
                    .andExpect(jsonPath("$.sequence").exists())
                    // New tasks must start incomplete: the contract gives clients no
                    // way to create an already-completed task.
                    .andExpect(jsonPath("$.completed", is(false)));
        }

        @Test
        @DisplayName("rejects a blank title with 400, because minLength is part of the contract")
        void rejectsBlankTitle() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"\",\"category\":0}"))
                    .andExpect(status().isBadRequest());
        }

        // [AI assisted 003] 以下四個測試由 AI 協助補齊：category 必填、enum 範圍外要被擋掉、
        // 兩個類別各自計數（互不推進），以及 dueDate 以純日期原樣往返。
        @Test
        @DisplayName("rejects a missing category with 400: the serial has no counter to come from")
        void rejectsMissingCategory() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"uncategorised\"}"))
                    .andExpect(status().isBadRequest());
        }

        // [AI assisted 005] category 改成數字碼之後，這個測試鎖住兩件事：範圍外的碼要被擋掉，
        // 以及舊契約的字串類別名不會被靜默接受 —— 沒跟上這次改動的客戶端會在邊界收到 400，
        // 而不是把壞資料寫進來。
        @Test
        @DisplayName("rejects a category outside the enum rather than storing an unrenderable value")
        void rejectsUnknownCategory() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"a chore\",\"category\":2}"))
                    .andExpect(status().isBadRequest());

            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"a bug\",\"category\":\"bug\"}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("draws the serial from the task's own category counter, not a shared one")
        void serialsAreCountedPerCategory() throws Exception {
            int firstBug = create("{\"title\":\"bug one\",\"category\":1}")
                    .get("sequence")
                    .asInt();

            // Numbering the feat run must leave no gap in the bug run: this is the
            // whole difference between two counters and one shared counter.
            create("{\"title\":\"feat one\",\"category\":0}");
            create("{\"title\":\"feat two\",\"category\":0}");

            int secondBug = create("{\"title\":\"bug two\",\"category\":1}")
                    .get("sequence")
                    .asInt();

            assertThat(secondBug).isEqualTo(firstBug + 1);
        }

        @Test
        @DisplayName("round-trips dueDate as a plain calendar date, with no time or zone")
        void storesDueDate() throws Exception {
            mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"ship it\",\"category\":0,\"dueDate\":\"2026-09-30\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.dueDate", is("2026-09-30")));
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
        @DisplayName("leaves description out of the list, and keeps it on the single task")
        void listOmitsDescription() throws Exception {
            UUID id = UUID.fromString(create("{\"title\":\"detail lives one request away\",\"category\":0,"
                            + "\"description\":\"The one field no card on the board draws\"}")
                    .get("id")
                    .asText());

            // A filter that matches nothing is an empty result, not an absent field:
            // hasSize(0) here says the row carried no description at all.
            mockMvc.perform(get("/api/tasks"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[?(@.id=='" + id + "')]", hasSize(1)))
                    .andExpect(jsonPath("$[?(@.id=='" + id + "')].description", hasSize(0)));

            // The detail is not gone, only moved: this is where the edit sheet reads it.
            mockMvc.perform(get("/api/tasks/{id}", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.description", is("The one field no card on the board draws")));
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
                            .content("{\"title\":\"renamed\",\"category\":0}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title", is("renamed")))
                    .andExpect(jsonPath("$.completed", is(true)));
        }

        // [AI assisted 003] 以下三個測試由 AI 協助補齊，鎖住這次契約修訂的三個承諾：
        // 改類別重新發號且 id 不變、同類別存檔號碼不變、PUT 省略欄位等於清空。
        @Test
        @DisplayName("moving to the other category re-issues the serial there, keeping the id")
        void movingCategoryReissuesTheSerial() throws Exception {
            UUID misfiled = UUID.fromString(
                    create("{\"title\":\"misfiled\",\"category\":0}")
                            .get("id")
                            .asText());
            int latestBug = create("{\"title\":\"a real bug\",\"category\":1}")
                    .get("sequence")
                    .asInt();

            mockMvc.perform(put("/api/tasks/{id}", misfiled)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"misfiled\",\"category\":1}"))
                    .andExpect(status().isOk())
                    // URLs and in-flight requests hold the id, so a move must not touch it…
                    .andExpect(jsonPath("$.id", is(misfiled.toString())))
                    .andExpect(jsonPath("$.category", is(1)))
                    // …while the displayed number follows the category, drawn fresh from the
                    // destination counter so it cannot collide with the bug already holding
                    // the serial this task arrived with.
                    .andExpect(jsonPath("$.sequence", is(latestBug + 1)));
        }

        @Test
        @DisplayName("saving without changing the category keeps the serial the user already knows")
        void sameCategoryKeepsTheSerial() throws Exception {
            JsonNode created = create("{\"title\":\"stable\",\"category\":1}");
            UUID id = UUID.fromString(created.get("id").asText());

            mockMvc.perform(put("/api/tasks/{id}", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"still stable\",\"category\":1}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sequence", is(created.get("sequence").asInt())));
        }

        @Test
        @DisplayName("is a full replace, so omitting description and dueDate clears them")
        void omittedFieldsAreCleared() throws Exception {
            JsonNode created = create("{\"title\":\"full\",\"category\":0,"
                    + "\"description\":\"detail\",\"dueDate\":\"2026-09-30\"}");
            UUID id = UUID.fromString(created.get("id").asText());

            mockMvc.perform(put("/api/tasks/{id}", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"full\",\"category\":0}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.description").doesNotExist())
                    .andExpect(jsonPath("$.dueDate").doesNotExist());
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
        @DisplayName("can reopen a completed task, so no separate un-complete endpoint is needed")
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
