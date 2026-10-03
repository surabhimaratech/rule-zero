package com.rule_zero.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"openrouter.api.key=test-key",
		"spring.neo4j.authentication.password=test-password"
})
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
