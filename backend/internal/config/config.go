package config

import "os"

// Config holds environment-driven configuration.
type Config struct {
	Port string
}

// Load reads configuration from environment variables.
func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	return Config{Port: port}
}
