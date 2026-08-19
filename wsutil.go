package main

import (
	"crypto/sha1"
	"encoding/base64"
)

// wsAcceptKey computes the Sec-WebSocket-Accept header value
func wsAcceptKey(key string) string {
	const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + magic))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}
