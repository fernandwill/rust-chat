// src/env_loader.rs
use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader};

pub fn load_env_file() -> Result<(), Box<dyn std::error::Error>> {
    // Try to load .env file
    let file = File::open(".env")?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line?;
        // Skip empty lines and comments
        if line.trim().is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse key=value pairs
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();

            // Remove quotes if present
            let value = if value.starts_with('"') && value.ends_with('"') {
                &value[1..value.len() - 1]
            } else if value.starts_with('\'') && value.ends_with('\'') {
                &value[1..value.len() - 1]
            } else {
                value
            };

            // Set environment variable
            unsafe {
                env::set_var(key, value);
            }
        }
    }

    Ok(())
}
