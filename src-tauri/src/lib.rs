// BoltDown Library
// This file can be used for shared utilities and types

pub mod utils {
    /// Convert markdown to HTML (placeholder for future implementation)
    pub fn markdown_to_html(markdown: &str) -> String {
        // TODO: Implement with pulldown-cmark or similar
        markdown.to_string()
    }

    /// Calculate word count from markdown
    pub fn word_count(text: &str) -> usize {
        text.split_whitespace().count()
    }

    /// Calculate reading time (225 WPM average)
    pub fn reading_time(text: &str) -> u32 {
        let words = word_count(text);
        ((words as f32 / 225.0).ceil() as u32).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_word_count() {
        let text = "Hello BoltDown";
        assert_eq!(utils::word_count(text), 2);
    }

    #[test]
    fn test_reading_time() {
        let text = "word ".repeat(450); // 450 words
        assert_eq!(utils::reading_time(&text), 2); // 2 minutes
    }
}
