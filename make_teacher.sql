-- Направи даден потребител учител (локална SQLite база)
-- Смени името в кавичките с твоето username:

UPDATE users
SET role = 'teacher'
WHERE username = 'LY';
