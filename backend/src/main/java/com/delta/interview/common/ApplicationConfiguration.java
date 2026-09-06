package com.delta.interview.common;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationConfiguration {

    /**
     * Exposes the system clock as a bean so timestamp-producing code can be
     * tested against a fixed instant instead of wall-clock {@code now()}.
     *
     * @return the system default-zone clock.
     */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
