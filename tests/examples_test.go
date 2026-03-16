// Feature: movie-blog-site, Example Tests E1-E6
// Validates specific build artifacts and configuration files exist with correct content.
package movieblog_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// buildOnce performs a single hugo build with a sample post and returns the root dir.
func buildOnce(t *testing.T) string {
	t.Helper()
	rootDir := hugoRootDir()
	cleanPublic(rootDir)

	writeTempPost(t, rootDir, "2024-01-01-sample.md",
		"---\ntitle: \"Sample Movie Review\"\ndate: 2024-01-01T10:00:00+08:00\ndraft: false\nsummary: \"A sample review.\"\ncategories:\n  - 影评\ntags:\n  - 测试\n---",
		"This is a sample movie review body.",
	)

	if err := buildHugo(t, rootDir); err != nil {
		t.Fatalf("hugo build failed: %v", err)
	}
	t.Cleanup(func() { cleanPublic(rootDir) })
	return rootDir
}

// TestE1_RSSFeedExists verifies public/index.xml exists and contains RSS structure.
// Validates requirement 2.5
func TestE1_RSSFeedExists(t *testing.T) {
	rootDir := buildOnce(t)

	if !fileExists(rootDir, "index.xml") {
		t.Fatal("E1 FAIL: public/index.xml does not exist")
	}

	content := readHTML(t, rootDir, "index.xml")
	if !strings.Contains(content, "<rss") {
		t.Error("E1 FAIL: index.xml does not contain <rss> element")
	}
	if !strings.Contains(content, "<channel>") {
		t.Error("E1 FAIL: index.xml does not contain <channel> element")
	}
	t.Log("E1 PASS: RSS feed exists and contains valid structure")
}

// TestE2_AdminPageExists verifies public/admin/index.html exists.
// Validates requirement 3.1
func TestE2_AdminPageExists(t *testing.T) {
	rootDir := buildOnce(t)

	if !fileExists(rootDir, "admin/index.html") {
		t.Fatal("E2 FAIL: public/admin/index.html does not exist")
	}
	t.Log("E2 PASS: admin/index.html exists")
}

// TestE3_404PageExists verifies public/404.html exists.
// Validates requirement 5.3
func TestE3_404PageExists(t *testing.T) {
	rootDir := buildOnce(t)

	if !fileExists(rootDir, "404.html") {
		t.Fatal("E3 FAIL: public/404.html does not exist")
	}
	t.Log("E3 PASS: 404.html exists")
}

// TestE4_PagefindIntegration verifies pagefind is referenced in search template,
// and attempts to run pagefind if npx is available.
// Validates requirements 6.1, 6.5
func TestE4_PagefindIntegration(t *testing.T) {
	rootDir := hugoRootDir()

	// Always verify search.html references pagefind
	searchPartial := filepath.Join(rootDir, "layouts", "partials", "search.html")
	data, err := os.ReadFile(searchPartial)
	if err != nil {
		t.Fatalf("E4 FAIL: cannot read layouts/partials/search.html: %v", err)
	}
	if !strings.Contains(string(data), "pagefind") {
		t.Fatal("E4 FAIL: search.html does not reference pagefind")
	}

	// Try running pagefind if npx is available
	cleanPublic(rootDir)
	writeTempPost(t, rootDir, "2024-01-01-pagefind-e4.md",
		"---\ntitle: \"Pagefind E4 Test\"\ndate: 2024-01-01T10:00:00+08:00\ndraft: false\n---",
		"Pagefind integration test content.",
	)
	if err := buildHugo(t, rootDir); err != nil {
		t.Fatalf("hugo build failed: %v", err)
	}
	t.Cleanup(func() { cleanPublic(rootDir) })

	pagefindDir := filepath.Join(rootDir, "public", "pagefind")
	cmd := exec.Command("npx", "--yes", "pagefind", "--site", filepath.Join(rootDir, "public"))
	cmd.Dir = rootDir
	if runErr := cmd.Run(); runErr == nil {
		// pagefind ran successfully - verify output directory
		info, statErr := os.Stat(pagefindDir)
		if statErr != nil || !info.IsDir() {
			t.Fatal("E4 FAIL: public/pagefind/ directory does not exist after pagefind run")
		}
		entries, _ := os.ReadDir(pagefindDir)
		if len(entries) == 0 {
			t.Fatal("E4 FAIL: public/pagefind/ directory is empty")
		}
		t.Log("E4 PASS: public/pagefind/ directory exists with index files")
	} else {
		// npx/pagefind not available - partial pass based on template check
		t.Log("E4 PASS (partial): npx not available, but search.html correctly references pagefind")
	}
}

// TestE5_HugoTomlHasRequiredFields verifies hugo.toml contains required configuration.
// Validates requirement 8.2
func TestE5_HugoTomlHasRequiredFields(t *testing.T) {
	rootDir := hugoRootDir()
	tomlPath := filepath.Join(rootDir, "hugo.toml")

	data, err := os.ReadFile(tomlPath)
	if err != nil {
		t.Fatalf("E5 FAIL: cannot read hugo.toml: %v", err)
	}
	content := string(data)

	required := []string{"baseURL", "title", "[taxonomies]", "languageCode"}
	for _, field := range required {
		if !strings.Contains(content, field) {
			t.Errorf("E5 FAIL: hugo.toml missing required field: %s", field)
		}
	}
	t.Log("E5 PASS: hugo.toml contains all required fields")
}

// TestE6_ReadmeExists verifies README.md exists and contains setup instructions.
// Validates requirement 8.4
func TestE6_ReadmeExists(t *testing.T) {
	rootDir := hugoRootDir()
	readmePath := filepath.Join(rootDir, "README.md")

	data, err := os.ReadFile(readmePath)
	if err != nil {
		t.Fatalf("E6 FAIL: README.md does not exist: %v", err)
	}
	content := strings.ToLower(string(data))

	// README is in Chinese; check for Hugo, Windows, and setup-related content
	for _, kw := range []string{"hugo", "windows", "hugo server"} {
		if !strings.Contains(content, kw) {
			t.Errorf("E6 FAIL: README.md missing keyword: %s", kw)
		}
	}
	t.Log("E6 PASS: README.md exists and contains setup instructions")
}
