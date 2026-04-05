-- InkSentinel database schema
-- Run this in pgAdmin Query Tool on the 'surveillance' database

CREATE TABLE feeds (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  client_id  TEXT UNIQUE NOT NULL,
  connected  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE detections (
  id          SERIAL PRIMARY KEY,
  feed_id     INT REFERENCES feeds(id),
  detected_at TIMESTAMPTZ NOT NULL,
  class_label TEXT NOT NULL,
  confidence  FLOAT
);

CREATE TABLE signals (
  id       SERIAL PRIMARY KEY,
  signal   TEXT NOT NULL,
  params   JSONB,
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  sent_by  TEXT NOT NULL
);

-- Demo data (remove before production)
INSERT INTO feeds (label, client_id, connected) VALUES
  ('Seat 01', 'seat-01', true),
  ('Seat 02', 'seat-02', true),
  ('Seat 03', 'seat-03', false),
  ('Seat 04', 'seat-04', true),
  ('Seat 05', 'seat-05', true);

INSERT INTO detections (feed_id, detected_at, class_label, confidence) VALUES
  (1, NOW() - INTERVAL '2 minutes',  'phone',      0.92),
  (1, NOW() - INTERVAL '90 seconds', 'phone',      0.88),
  (4, NOW() - INTERVAL '60 seconds', 'person',     0.95),
  (3, NOW() - INTERVAL '45 seconds', 'book',       0.76),
  (4, NOW() - INTERVAL '30 seconds', 'cell phone', 0.91),
  (4, NOW() - INTERVAL '15 seconds', 'person',     0.87),
  (1, NOW() - INTERVAL '5 seconds',  'phone',      0.94);