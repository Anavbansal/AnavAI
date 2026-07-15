package main

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type NewsItem struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Source      string `json:"source"`
	PublishedAt string `json:"publishedAt"`
}

type RSSFeed struct {
	Channel struct {
		Items []struct {
			Title   string `xml:"title"`
			Link    string `xml:"link"`
			PubDate string `xml:"pubDate"`
			Desc    string `xml:"description"`
		} `xml:"item"`
	} `xml:"channel"`
}

func fetchNews(symbol string) []NewsItem {
	queries := []string{
		symbol + " stock NSE India",
		symbol + " share price",
	}

	var items []NewsItem
	client := &http.Client{Timeout: 8 * time.Second}

	for _, q := range queries {
		rssURL := fmt.Sprintf(
			"https://news.google.com/rss/search?q=%s&hl=en-IN&gl=IN&ceid=IN:en",
			url.QueryEscape(q),
		)
		req, _ := http.NewRequest("GET", rssURL, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0")
		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var feed RSSFeed
		if err := xml.Unmarshal(body, &feed); err != nil {
			continue
		}
		for _, item := range feed.Channel.Items {
			if len(items) >= 10 {
				break
			}
			// Clean description
			desc := item.Desc
			if len(desc) > 200 {
				desc = desc[:200] + "..."
			}
			// Extract source from title
			source := "News"
			if parts := strings.Split(item.Title, " - "); len(parts) > 1 {
				source = parts[len(parts)-1]
				item.Title = strings.Join(parts[:len(parts)-1], " - ")
			}
			items = append(items, NewsItem{
				Title:       item.Title,
				Description: desc,
				URL:         item.Link,
				Source:      source,
				PublishedAt: item.PubDate,
			})
		}
		if len(items) >= 8 {
			break
		}
	}
	return items
}

func handleNewsRoute(w http.ResponseWriter, r *http.Request) {
	symbol := r.URL.Query().Get("instrument_keys")
	if symbol == "" {
		symbol = r.URL.Query().Get("symbol")
	}
	if symbol == "" {
		symbol = "NIFTY"
	}
	// Clean symbol
	symbol = strings.ToUpper(strings.Split(symbol, "|")[0])

	cKey := "news:" + symbol
	if cached, ok := cache.Get(cKey); ok {
		writeJSON(w, 200, cached)
		return
	}

	news := fetchNews(symbol)
	result := map[string]interface{}{
		"status": "success",
		"data":   news,
	}
	cache.Set(cKey, result, 3*time.Minute)
	writeJSON(w, 200, result)
}
