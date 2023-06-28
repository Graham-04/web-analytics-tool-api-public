-- Total Views
SELECT COUNT(userhash)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2025-05-23 08:00';

-- Top referers
SELECT referer, COUNT(*)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2023-05-25 08:00'
GROUP BY referer
ORDER BY COUNT(*) DESC
LIMIT 5;

-- Top Countries
SELECT countrycode, COUNT(userhash)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2023-05-28 08:00'
GROUP BY countrycode
ORDER BY COUNT(*) DESC
LIMIT 5;

-- Top Pages
SELECT page, COUNT(*)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2023-05-28 08:00'
GROUP BY page
ORDER BY COUNT(*) DESC
LIMIT 5;

-- Time Spent (Not Used)
SELECT AVG(timeSpent)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2023-05-25 08:00';

-- Unique Visitors
SELECT COUNT(DISTINCT userHash)
FROM pageviews
WHERE websiteId = 'db7e7010-64e7-4700-8234-f30e7bc1c315'
  AND time BETWEEN '2023-05-23 02:00' AND '2023-05-25 08:00';