package com.vijay.apimanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class ApiManagerApplication {

    public static void main(String[] args) {
        // Create application directory if it doesn't exist
        String userHome = System.getProperty("user.home");
        java.io.File appDir = new java.io.File(userHome, ".api-manager");
        if (!appDir.exists()) {
            appDir.mkdirs();
            new java.io.File(appDir, "logs").mkdirs();
            new java.io.File(appDir, "uploads").mkdirs();
        }
        
        SpringApplication.run(ApiManagerApplication.class, args);
        
        System.out.println("\n" +
            "====================================\n" +
            "   API Automation Tool 3.0 Started!\n" +
            "   Access: http://localhost:8082\n" +
            "====================================\n");
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .maxAge(3600);
            }
        };
    }
}
