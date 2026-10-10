CREATE TABLE book_layout (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  placements TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO book_layout (id) VALUES (1);
