 -- User roles table for Clerk integration
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY,
  role TEXT NOT NULL
);
