package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// CASFund represents a parsed mutual fund from CAS PDF
type CASFund struct {
	SchemeCode  string  `json:"schemeCode"`
	SchemeName  string  `json:"schemeName"`
	ISIN        string  `json:"isin"`
	Folio       string  `json:"folio"`
	AMC         string  `json:"amc"`
	Units       float64 `json:"units"`
	AvgNav      float64 `json:"avgNav"`
	CostValue   float64 `json:"costValue"`
	MarketValue float64 `json:"marketValue"`
	CurrentNav  float64 `json:"currentNav"`
}

// ISIN → schemeCode mapping (mfapi.in uses schemeCode)
// We'll search by ISIN via mfapi search
var isinToSchemeCode = map[string]string{}

// parseCASText extracts fund holdings from CAS PDF text
func parseCASText(text string) []CASFund {
	lines := strings.Split(text, "\n")
	var funds []CASFund

	// Regex patterns for CAS format (CAMS + KFintech)
	reISIN        := regexp.MustCompile(`ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{9}\d)`)
	reUnits       := regexp.MustCompile(`(?i)closing\s+balance\s*\(?\s*units?\s*\)?\s*[:\-]?\s*([\d,]+\.?\d*)`)
	reNavCost     := regexp.MustCompile(`([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$`)
	reFolio       := regexp.MustCompile(`(?i)folio\s+(?:no\.?|number)?\s*:?\s*([\w\/\s]+?)(?:\s+PAN|\s+Email|\s*$)`)
	reAMC         := regexp.MustCompile(`(?i)(.*?\s+Mutual\s+Fund)`)
	reUnitsSimple := regexp.MustCompile(`(?i)(?:units|balance)\s*:?\s*([\d,]+\.?\d+)`)
	reAvgCost     := regexp.MustCompile(`(?i)(?:avg\.?\s*cost|average\s*cost|cost\s*per\s*unit)\s*:?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d+)`)
	reCostValue   := regexp.MustCompile(`(?i)(?:cost\s*value|purchase\s*value|invested)\s*:?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+\.?\d+)`)

	var (
		currentAMC   string
		currentFolio string
		currentISIN  string
		currentName  string
		inFund       bool
		fundLines    []string
	)

	flushFund := func() {
		if !inFund || currentName == "" { return }

		fund := CASFund{
			ISIN:  currentISIN,
			Folio: strings.TrimSpace(currentFolio),
			AMC:   strings.TrimSpace(currentAMC),
		}

		// Clean scheme name
		name := strings.TrimSpace(currentName)
		// Remove common suffixes noise
		name = regexp.MustCompile(`\s+(-\s+)?(?:Direct|Regular)\s+Plan`).ReplaceAllString(name, " - $0")
		fund.SchemeName = name

		// Search for units in fund block
		blockText := strings.Join(fundLines, "\n")

		// Closing balance units
		if m := reUnits.FindStringSubmatch(blockText); len(m) > 1 {
			fund.Units = parseNum(m[1])
		} else if m := reUnitsSimple.FindStringSubmatch(blockText); len(m) > 1 {
			fund.Units = parseNum(m[1])
		}

		// Average cost / cost per unit
		if m := reAvgCost.FindStringSubmatch(blockText); len(m) > 1 {
			fund.AvgNav = parseNum(m[1])
		}

		// Cost value (total invested)
		if m := reCostValue.FindStringSubmatch(blockText); len(m) > 1 {
			fund.CostValue = parseNum(m[1])
		}

		// If we have cost value but not avg nav, compute it
		if fund.AvgNav == 0 && fund.CostValue > 0 && fund.Units > 0 {
			fund.AvgNav = math.Round(fund.CostValue/fund.Units*100) / 100
		}

		// Look for nav/value table rows: units nav value
		for _, l := range fundLines {
			if m := reNavCost.FindStringSubmatch(strings.TrimSpace(l)); len(m) == 4 {
				u := parseNum(m[1])
				n := parseNum(m[2])
				v := parseNum(m[3])
				if u > 0 && n > 0 && v > 0 && math.Abs(u*n-v) < v*0.02 {
					if fund.Units == 0 { fund.Units = u }
					if fund.CurrentNav == 0 { fund.CurrentNav = n }
					if fund.MarketValue == 0 { fund.MarketValue = v }
				}
			}
		}

		if fund.Units > 0 && fund.SchemeName != "" {
			funds = append(funds, fund)
		}

		// Reset
		currentName = ""
		currentISIN = ""
		fundLines   = nil
		inFund      = false
	}

	for i, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" { continue }

		// AMC name detection
		if m := reAMC.FindStringSubmatch(line); len(m) > 1 {
			// Make sure it's not a fund name line (fund names often contain AMC)
			if !strings.Contains(strings.ToLower(line), "fund -") &&
				!strings.Contains(strings.ToLower(line), "plan") &&
				!strings.Contains(strings.ToLower(line), "option") {
				flushFund()
				currentAMC = m[1]
				continue
			}
		}

		// Folio number
		if m := reFolio.FindStringSubmatch(line); len(m) > 1 {
			currentFolio = strings.TrimSpace(m[1])
			continue
		}

		// ISIN line — marks start of a new fund
		if m := reISIN.FindStringSubmatch(line); len(m) > 1 {
			flushFund()
			currentISIN = m[1]
			inFund = true
			fundLines = []string{}
			// Scheme name is usually the line just before ISIN
			for j := i - 1; j >= max(0, i-5); j-- {
				prev := strings.TrimSpace(lines[j])
				if prev != "" && !strings.HasPrefix(strings.ToLower(prev), "registrar") &&
					!strings.HasPrefix(strings.ToLower(prev), "folio") &&
					!strings.Contains(strings.ToLower(prev), "pan:") &&
					len(prev) > 5 {
					currentName = prev
					break
				}
			}
			continue
		}

		if inFund {
			fundLines = append(fundLines, line)
			// Stop collecting if we hit next section markers
			if strings.Contains(strings.ToLower(line), "grand total") ||
				strings.Contains(strings.ToLower(line), "total value") {
				flushFund()
			}
		}
	}
	flushFund()

	// Deduplicate by ISIN
	seen := map[string]bool{}
	var deduped []CASFund
	for _, f := range funds {
		key := f.ISIN
		if key == "" { key = f.SchemeName }
		if !seen[key] {
			seen[key] = true
			deduped = append(deduped, f)
		}
	}
	return deduped
}

func parseNum(s string) float64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func max(a, b int) int {
	if a > b { return a }
	return b
}

// ── /api/mf/parse-cas ─────────────────────────────────────────────────────────
func handleCASParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "POST only"})
		return
	}

	// 20MB limit
	r.ParseMultipartForm(20 << 20)
	file, header, err := r.FormFile("cas")
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "cas file required: " + err.Error()})
		return
	}
	defer file.Close()

	log.Printf("[CAS] Parsing file: %s (%.1f KB)", header.Filename, float64(header.Size)/1024)

	// Save to temp file
	tmp, err := os.CreateTemp("", "cas-*.pdf")
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "temp file: " + err.Error()})
		return
	}
	defer os.Remove(tmp.Name())

	if _, err := io.Copy(tmp, file); err != nil {
		writeJSON(w, 500, map[string]string{"error": "save: " + err.Error()})
		return
	}
	tmp.Close()

	// Check if password protected — try without password first
	text, err := pdfToText(tmp.Name(), "")
	if err != nil || strings.TrimSpace(text) == "" {
		// Try with common CAS passwords (usually PAN uppercase)
		pan := r.FormValue("pan")
		if pan != "" {
			text, err = pdfToText(tmp.Name(), strings.ToUpper(pan))
		}
		if err != nil || strings.TrimSpace(text) == "" {
			writeJSON(w, 400, map[string]interface{}{
				"error":   "Could not extract text from PDF. If password-protected, provide PAN.",
				"details": fmt.Sprintf("%v", err),
			})
			return
		}
	}

	// Parse funds
	funds := parseCASText(text)
	log.Printf("[CAS] Extracted %d funds from PDF", len(funds))

	// Try to resolve scheme codes via mfapi search
	for i := range funds {
		code := resolveSchemeCode(funds[i].SchemeName, funds[i].ISIN)
		funds[i].SchemeCode = code
	}

	writeJSON(w, 200, map[string]interface{}{
		"status": "success",
		"count":  len(funds),
		"funds":  funds,
	})
}

func pdfToText(pdfPath, password string) (string, error) {
	args := []string{"-layout", "-nopgbrk"}
	if password != "" {
		args = append(args, "-upw", password)
	}
	args = append(args, pdfPath, "-")

	cmd := exec.Command("pdftotext", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// resolveSchemeCode searches mfapi.in for the scheme code by name
func resolveSchemeCode(name, isin string) string {
	if name == "" { return "" }

	// Cache check
	cacheKey := "mfcode:" + isin + ":" + name
	if cached, ok := cache.Get(cacheKey); ok {
		if s, ok := cached.(string); ok { return s }
	}

	// Build search query — use key words from fund name
	words := strings.Fields(name)
	query := name
	if len(words) > 4 { query = strings.Join(words[:4], " ") }

	resp, err := http.Get("https://api.mfapi.in/mf/search?q=" + strings.ReplaceAll(query, " ", "%20"))
	if err != nil { return "" }
	defer resp.Body.Close()

	var results []struct {
		SchemeCode int    `json:"schemeCode"`
		SchemeName string `json:"schemeName"`
	}
	json.NewDecoder(resp.Body).Decode(&results)

	// Find best match
	nameLower := strings.ToLower(name)
	for _, r := range results {
		rl := strings.ToLower(r.SchemeName)
		// Check if key words match
		matchScore := 0
		for _, w := range words {
			if len(w) > 3 && strings.Contains(rl, strings.ToLower(w)) {
				matchScore++
			}
		}
		if matchScore >= 3 || strings.Contains(rl, nameLower[:min(20, len(nameLower))]) {
			code := strconv.Itoa(r.SchemeCode)
			cache.Set(cacheKey, code, 24*3600*1000000000)
			return code
		}
	}

	if len(results) > 0 {
		code := strconv.Itoa(results[0].SchemeCode)
		cache.Set(cacheKey, code, 24*3600*1000000000)
		return code
	}
	return ""
}

func min(a, b int) int {
	if a < b { return a }
	return b
}

// handleCASText — if pdftotext not available, accept raw text
func handleCASText(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "POST only"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	text := string(body)
	funds := parseCASText(text)
	for i := range funds {
		funds[i].SchemeCode = resolveSchemeCode(funds[i].SchemeName, funds[i].ISIN)
	}
	writeJSON(w, 200, map[string]interface{}{
		"status": "success", "count": len(funds), "funds": funds,
	})
}

// init registers temp dir cleanup
func init() {
	_ = filepath.Join // avoid import issue
}
