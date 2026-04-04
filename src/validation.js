// Input validation utilities
export function validateId(value, name) {
  if (!value || typeof value !== "string") throw new Error(`${name} is required and must be a string`);
  if (value.length > 200 || !/^[\w-]+$/.test(value)) throw new Error(`${name} contains invalid characters`);
  return value;
}

export function validateDate(value, name) {
  if (!value || typeof value !== "string") throw new Error(`${name} is required`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must be in YYYY-MM-DD format`);
  return value;
}

export function validateISODate(value, name) {
  if (!value || typeof value !== "string") throw new Error(`${name} is required`);
  if (isNaN(Date.parse(value))) throw new Error(`${name} must be a valid ISO 8601 date string`);
  return value;
}

export function validateEnum(value, allowed, name) {
  if (value !== undefined && value !== null && !allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

export function validateStringArray(value, name, maxItems = 50) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  if (value.length > maxItems) throw new Error(`${name} exceeds maximum of ${maxItems} items`);
  for (const item of value) {
    if (typeof item !== "string") throw new Error(`${name} must contain only strings`);
  }
  return value;
}

// Outbound rate limiter — prevents exhausting Motion API quotas
export function createRateLimiter(maxRequests, windowMs) {
  const timestamps = [];
  return function checkLimit(label) {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) timestamps.shift();
    if (timestamps.length >= maxRequests) {
      throw new Error(`Rate limit reached for ${label}. Try again in a few seconds.`);
    }
    timestamps.push(now);
  };
}
