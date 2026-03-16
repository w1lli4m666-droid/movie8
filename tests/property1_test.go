// Feature: movie-blog-site, Property 1: Markdown 到 HTML 的构建 Round-Trip
// Validates: Requirements 2.1
package movieblog_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/leanovate/gopter"
	"github.com/leanovate/gopter/gen"
	"github.com/leanovate/gopter/prop"
)

// TestProperty1_MarkdownToHTMLRoundTrip verifies that for any valid non-draft
// Markdown post, after a Hugo build, the corresponding HTML file exists in
// public/ and contains the original post title.
func TestProperty1_MarkdownToHTMLRoundTrip(t *testing.T) {
	rootDir := hugoRootDir()

	properties := gopter.NewProperties(gopter.DefaultTestParametersWithSeed(1234))
	properties.Property("non-draft post produces HTML containing title", prop.ForAll(
		func(title string) bool {
			// Ensure title is non-empty after trimming
			title = strings.TrimSpace(title)
			if title == "" {
				return true // skip degenerate case
			}

			slug := generateSlug(title)
			if slug == "" {
				return true // skip if slug is empty (e.g. all special chars)
			}

			filename := fmt.Sprintf("2024-01-15-%s.md", slug)
			frontMatter := fmt.Sprintf("---\ntitle: %q\ndate: 2024-01-15T10:00:00+08:00\ndraft: false\n---", title)
			body := "This is the post body."

			cleanPublic(rootDir)
			writeTempPost(t, rootDir, filename, frontMatter, body)

			if err := buildHugo(t, rootDir); err != nil {
				t.Logf("hugo build failed for title %q: %v", title, err)
				return false
			}

			htmlPath := fmt.Sprintf("posts/2024-01-15-%s/index.html", slug)
			if !fileExists(rootDir, htmlPath) {
				t.Logf("HTML file not found: %s", htmlPath)
				return false
			}

			html := readHTML(t, rootDir, htmlPath)
			if !strings.Contains(html, title) {
				t.Logf("HTML does not contain title %q", title)
				return false
			}

			t.Cleanup(func() { cleanPublic(rootDir) })
			return true
		},
		// Generate ASCII alphanumeric titles, 5-20 characters
		gen.RegexMatch(`[a-zA-Z0-9]{5,20}`),
	))

	properties.TestingRun(t, gopter.ConsoleReporter(false))
}
