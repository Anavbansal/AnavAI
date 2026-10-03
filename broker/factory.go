package broker

import (
	"fmt"
	"strings"
	"sync"
)

// Registry holds all registered brokers
var (
	mu       sync.RWMutex
	registry = make(map[string]Broker)
)

// Register adds a broker implementation to the registry
func Register(b Broker) {
	mu.Lock()
	defer mu.Unlock()
	registry[strings.ToLower(b.Name())] = b
}

// Get returns a registered broker by name
func Get(name string) (Broker, error) {
	mu.RLock()
	defer mu.RUnlock()
	b, ok := registry[strings.ToLower(name)]
	if !ok {
		return nil, fmt.Errorf("broker %q not registered", name)
	}
	return b, nil
}

// GetAuthenticated returns first authenticated broker
// Priority: upstox > angelone (can change based on user preference)
func GetAuthenticated(preferredBroker string) (Broker, error) {
	mu.RLock()
	defer mu.RUnlock()

	// Try preferred first
	if preferredBroker != "" {
		if b, ok := registry[strings.ToLower(preferredBroker)]; ok && b.IsAuthenticated() {
			return b, nil
		}
	}

	// Priority order
	for _, name := range []string{"upstox", "angelone"} {
		if b, ok := registry[name]; ok && b.IsAuthenticated() {
			return b, nil
		}
	}

	return nil, fmt.Errorf("no authenticated broker available")
}

// All returns all registered broker names
func All() []string {
	mu.RLock()
	defer mu.RUnlock()
	names := make([]string, 0, len(registry))
	for k := range registry {
		names = append(names, k)
	}
	return names
}
