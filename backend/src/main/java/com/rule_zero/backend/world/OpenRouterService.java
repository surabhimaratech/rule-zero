package com.rule_zero.backend.world;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class OpenRouterService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenRouterService(
            @Value("${openrouter.api.url}") String apiUrl,
            @Value("${openrouter.api.key}") String apiKey
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(apiUrl)
                .defaultHeader(
                        HttpHeaders.AUTHORIZATION,
                        "Bearer " + apiKey
                )
                .defaultHeader(
                        HttpHeaders.CONTENT_TYPE,
                        MediaType.APPLICATION_JSON_VALUE
                )
                .build();
    }

    public GeneratedWorldResponse generateConsequences(String rule) {
        String prompt = """
                You are simulating a fictional world through cause and effect.

                Given one foundational rule, generate exactly 5 direct
                first-order consequences.

                Do not create a full story.
                Do not jump many causal steps ahead.
                Each consequence must directly follow from the rule.

                Return ONLY valid JSON in this exact shape:

                {
                  "consequences": [
                    {
                      "title": "short title",
                      "description": "1-2 sentence causal explanation",
                      "domain": "Biology | Economics | Politics | Culture | Technology | Environment | Demographics | Medicine | Other"
                    }
                  ]
                }

                Foundational rule:
                """ + rule;

        Map<String, Object> body = Map.of(
                "model", "openai/gpt-4.1-mini",
                "max_tokens", 800,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        String response = restClient.post()
                .body(body)
                .retrieve()
                .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(response);

            String content =
                    root.path("choices")
                            .get(0)
                            .path("message")
                            .path("content")
                            .asText();

            String cleanedContent = content
                .replace("```json", "")
                .replace("```", "")
                .trim();

                return objectMapper.readValue(
                        cleanedContent,
                        GeneratedWorldResponse.class
                );

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to parse OpenRouter response",
                    e
            );
        }
    }

    public GeneratedWorldResponse generateNextConsequences(
        String parentTitle,
        String parentDescription
        ) {
        String prompt = """
                You are simulating a fictional world through cause and effect.

                The following event or condition already exists in the world:

                Title:
                %s

                Explanation:
                %s

                Generate exactly 3 direct consequences that would plausibly
                follow from THIS condition.

                Important:
                - Generate only the next causal step.
                - Do not jump far into the future.
                - Do not repeat the parent condition.
                - Each consequence should materially change the world.
                - Keep each title concise.

                Return ONLY valid JSON in this exact shape:

                {
                "consequences": [
                        {
                        "title": "short title",
                        "description": "1-2 sentence causal explanation",
                        "domain": "Biology | Economics | Politics | Culture | Technology | Environment | Demographics | Medicine | Other"
                        }
                ]
                }
                """.formatted(parentTitle, parentDescription);

        Map<String, Object> body = Map.of(
                "model", "openai/gpt-4.1-mini",
                "max_tokens", 600,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        String response = restClient.post()
                .body(body)
                .retrieve()
                .body(String.class);

        try {
                JsonNode root = objectMapper.readTree(response);

                String content =
                        root.path("choices")
                                .get(0)
                                .path("message")
                                .path("content")
                                .asText();

                String cleanedContent = content
                        .replace("```json", "")
                        .replace("```", "")
                        .trim();

                return objectMapper.readValue(
                        cleanedContent,
                        GeneratedWorldResponse.class
                );

        } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse OpenRouter response",
                        e
                );
        }
        }

        public GeneratedAlternativesResponse generateOutcomeAlternatives(
                String parentTitle,
                String parentDescription,
                String currentTitle,
                String currentDescription
        ) {
        String prompt = """
                You are simulating a fictional world through cause and effect.

                A parent condition currently leads to this consequence:

                Parent title:
                %s

                Parent description:
                %s

                Current consequence title:
                %s

                Current consequence description:
                %s

                Generate exactly 3 substantially different, plausible
                alternative consequences that could follow from the parent
                instead. Do not make minor rewrites of the current consequence.
                Explore meaningfully different causal directions while staying
                grounded in the parent and current world context.

                Return ONLY valid JSON in this exact shape:

                {
                  "alternatives": [
                    {
                      "title": "short outcome title",
                      "description": "1-2 sentence explanation",
                      "domain": "Biology | Economics | Politics | Culture | Technology | Environment | Demographics | Medicine | Other"
                    }
                  ]
                }
                """.formatted(
                parentTitle,
                parentDescription,
                currentTitle,
                currentDescription
        );

        Map<String, Object> body = Map.of(
                "model", "openai/gpt-4.1-mini",
                "max_tokens", 450,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        String response = restClient.post()
                .body(body)
                .retrieve()
                .body(String.class);

        try {
                JsonNode root = objectMapper.readTree(response);

                String content =
                        root.path("choices")
                                .get(0)
                                .path("message")
                                .path("content")
                                .asText();

                String cleanedContent = content
                        .replace("```json", "")
                        .replace("```", "")
                        .trim();

                return objectMapper.readValue(
                        cleanedContent,
                        GeneratedAlternativesResponse.class
                );

        } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse OpenRouter alternatives response",
                        e
                );
        }
        }

        public GeneratedOutcomeResponse generateOutcomeDetails(String title) {
        String prompt = """
                Given the following outcome in a fictional world, generate a
                concise description and choose the most appropriate domain.

                Return ONLY valid JSON in this exact shape:

                {
                  "description": "1-2 sentence explanation",
                  "domain": "Biology | Economics | Politics | Culture | Technology | Environment | Demographics | Medicine | Other"
                }

                Outcome title:
                """ + title;

        Map<String, Object> body = Map.of(
                "model", "openai/gpt-4.1-mini",
                "max_tokens", 120,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        String response = restClient.post()
                .body(body)
                .retrieve()
                .body(String.class);

        try {
                JsonNode root = objectMapper.readTree(response);

                String content =
                        root.path("choices")
                                .get(0)
                                .path("message")
                                .path("content")
                                .asText();

                String cleanedContent = content
                        .replace("```json", "")
                        .replace("```", "")
                        .trim();

                return objectMapper.readValue(
                        cleanedContent,
                        GeneratedOutcomeResponse.class
                );

        } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse OpenRouter outcome response",
                        e
                );
        }
        }

        public String explainCausalLink(
                String parentTitle,
                String parentDescription,
                String childTitle,
                String childDescription
        ) {
        String prompt = """
                Explain why the following consequence plausibly follows
                from the condition before it.

                Cause:
                %s

                Cause explanation:
                %s

                Consequence:
                %s

                Consequence explanation:
                %s

                Explain the causal connection clearly in 2-4 sentences.
                Do not introduce unrelated worldbuilding.
                """.formatted(
                parentTitle,
                parentDescription,
                childTitle,
                childDescription
        );

        Map<String, Object> body = Map.of(
                "model", "openai/gpt-4.1-mini",
                "max_tokens", 250,
                "messages", List.of(
                        Map.of(
                                "role", "user",
                                "content", prompt
                        )
                )
        );

        String response = restClient.post()
                .body(body)
                .retrieve()
                .body(String.class);

        try {
                JsonNode root = objectMapper.readTree(response);

                return root.path("choices")
                        .get(0)
                        .path("message")
                        .path("content")
                        .asText()
                        .trim();

        } catch (Exception e) {
                throw new RuntimeException(
                        "Failed to parse explanation",
                        e
                );
        }
        }


}