"""Small dependency-free TTL cache for registry responses."""

import time


class TTLCache:
    def __init__(self, ttl_seconds=900, clock=None):
        if ttl_seconds < 0:
            raise ValueError("ttl_seconds must be non-negative")
        self.ttl_seconds = ttl_seconds
        self._clock = clock or time.time
        self._values = {}

    def get(self, key):
        item = self._values.get(key)
        if not item:
            return None
        stored_at, value = item
        if self._clock() - stored_at > self.ttl_seconds:
            self._values.pop(key, None)
            return None
        return value

    def set(self, key, value):
        self._values[key] = (self._clock(), value)
