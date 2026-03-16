package movieblog_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"unicode"
)

// hugoRootDir returns the workspace root directory (parent of tests/).
func hugoRootDir() string {
	// tests/ is one level below the workspace root
	dir, err := filepath.Abs(filepath.Join(".."))
	if err != nil {
		panic("failed to resolve hugo root dir: " + err.Error())
	}
	return dir
}

// buildHugo runs `hugo --source <rootDir>` and returns any error.
func buildHugo(t *testing.T, rootDir string) error {
	t.Helper()
	cmd := exec.Command("hugo", "--source", rootDir)
	cmd.Dir = rootDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Logf("hugo build output:\n%s", string(out))
	}
	return err
}

// cleanPublic removes the public/ directory under rootDir.
func cleanPublic(rootDir string) {
	_ = os.RemoveAll(filepath.Join(rootDir, "public"))
}

// writeTempPost writes a Markdown post file to content/posts/ and registers
// a cleanup function to delete it after the test.
func writeTempPost(t *testing.T, rootDir, filename, frontMatter, body string) {
	t.Helper()
	postsDir := filepath.Join(rootDir, "content", "posts")
	if err := os.MkdirAll(postsDir, 0755); err != nil {
		t.Fatalf("failed to create posts dir: %v", err)
	}
	path := filepath.Join(postsDir, filename)
	content := frontMatter + "\n" + body
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write temp post %s: %v", filename, err)
	}
	t.Cleanup(func() {
		_ = os.Remove(path)
	})
}

// readHTML reads and returns the content of a file at public/<relPath>.
func readHTML(t *testing.T, rootDir, relPath string) string {
	t.Helper()
	path := filepath.Join(rootDir, "public", relPath)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read HTML file %s: %v", relPath, err)
	}
	return string(data)
}

// fileExists reports whether public/<relPath> exists under rootDir.
func fileExists(rootDir, relPath string) bool {
	path := filepath.Join(rootDir, "public", relPath)
	_, err := os.Stat(path)
	return err == nil
}

// generateSlug converts a title to a URL-friendly slug:
// lowercase, spaces replaced with hyphens, non-alphanumeric characters removed.
func generateSlug(title string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(title) {
		switch {
		case r == ' ' || r == '-':
			b.WriteRune('-')
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(r)
		// skip all other characters
		}
	}
	// collapse consecutive hyphens
	result := b.String()
	for strings.Contains(result, "--") {
		result = strings.ReplaceAll(result, "--", "-")
	}
	return strings.Trim(result, "-")
}
