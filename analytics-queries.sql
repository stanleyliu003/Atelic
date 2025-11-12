-- Analytics Queries for QuickSight Dashboard
-- Run these in Athena to verify data is working correctly

-- 1. Total Registered Users
SELECT COUNT(*) as total_users
FROM atelic_analytics.user_profiles;

-- 2. Average Metrics
SELECT
  AVG(ownedTripsCount) as avg_trips_per_user,
  AVG(avgActivitiesPerTrip) as avg_activities_per_trip,
  AVG(avgCollaboratorsPerTrip) as avg_collaborators_per_trip,
  AVG(avgTripDuration) as avg_trip_duration
FROM atelic_analytics.user_profiles;

-- 3. Gender Distribution
SELECT
  gender,
  COUNT(*) as user_count
FROM atelic_analytics.user_profiles
GROUP BY gender;

-- 4. Age Distribution (with bins)
SELECT
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END as age_group,
  COUNT(*) as user_count
FROM atelic_analytics.user_profiles
WHERE age IS NOT NULL
GROUP BY
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END
ORDER BY user_count DESC;

-- 5. Trip Status Distribution
SELECT
  SUM(totalTripsCompleted) as total_completed,
  SUM(totalTripsInProgress) as total_in_progress,
  SUM(totalTripsUpcoming) as total_upcoming
FROM atelic_analytics.user_profiles;

-- 6. App Version Distribution
SELECT
  appVersion,
  COUNT(*) as user_count
FROM atelic_analytics.user_profiles
GROUP BY appVersion
ORDER BY user_count DESC;

-- 7. User Engagement Tiers
SELECT
  CASE
    WHEN ownedTripsCount = 0 THEN 'New User (0 trips)'
    WHEN ownedTripsCount >= 1 AND ownedTripsCount <= 2 THEN 'Active User (1-2 trips)'
    WHEN ownedTripsCount >= 3 THEN 'Power User (3+ trips)'
  END as user_tier,
  COUNT(*) as user_count
FROM atelic_analytics.user_profiles
GROUP BY
  CASE
    WHEN ownedTripsCount = 0 THEN 'New User (0 trips)'
    WHEN ownedTripsCount >= 1 AND ownedTripsCount <= 2 THEN 'Active User (1-2 trips)'
    WHEN ownedTripsCount >= 3 THEN 'Power User (3+ trips)'
  END
ORDER BY user_count DESC;

-- 8. Power Users Analysis (users with 3+ trips)
SELECT
  age,
  gender,
  ownedTripsCount,
  totalActivitiesOwned,
  totalCollaboratorsAcrossTrips,
  avgActivitiesPerTrip,
  avgCollaboratorsPerTrip,
  avgTripDuration,
  accountCreatedAt
FROM atelic_analytics.user_profiles
WHERE ownedTripsCount >= 3
ORDER BY ownedTripsCount DESC;

-- 9. Users by Trips Created
SELECT
  ownedTripsCount,
  COUNT(*) as user_count
FROM atelic_analytics.user_profiles
GROUP BY ownedTripsCount
ORDER BY ownedTripsCount;

-- 10. Active Users (Last 30 days)
SELECT COUNT(*) as active_last_30_days
FROM atelic_analytics.user_profiles
WHERE lastActiveAt >= CAST(date_add('day', -30, current_timestamp) AS TIMESTAMP);

-- 11. User Growth Over Time (by account creation)
SELECT
  DATE_TRUNC('day', accountCreatedAt) as signup_date,
  COUNT(*) as new_users
FROM atelic_analytics.user_profiles
GROUP BY DATE_TRUNC('day', accountCreatedAt)
ORDER BY signup_date;

-- 12. Full User Data (for QuickSight import)
SELECT
  age,
  appVersion,
  avgActivitiesPerTrip,
  avgCollaboratorsPerTrip,
  avgTripDuration,
  followersCount,
  followingCount,
  gender,
  ownedTripsCount,
  totalActivitiesOwned,
  totalCollaboratorsAcrossTrips,
  totalTripDuration,
  totalTripsCompleted,
  totalTripsInProgress,
  totalTripsUpcoming,
  accountCreatedAt,
  lastActiveAt
FROM atelic_analytics.user_profiles;

-- 13. Data Freshness (latest timestamps and staleness)
SELECT
  MAX(accountCreatedAt) AS latest_account_created_at,
  MAX(lastActiveAt) AS latest_last_active_at,
  DATE_DIFF('day', MAX(accountCreatedAt), current_timestamp) AS days_since_latest_signup,
  DATE_DIFF('day', MAX(lastActiveAt), current_timestamp) AS days_since_latest_activity
FROM atelic_analytics.user_profiles;

-- 14. Null Counts Per Column + Row Count
SELECT
  COUNT(*)                                         AS row_count,
  SUM(CASE WHEN age IS NULL THEN 1 ELSE 0 END)     AS null_age,
  SUM(CASE WHEN appVersion IS NULL THEN 1 ELSE 0 END) AS null_appVersion,
  SUM(CASE WHEN avgActivitiesPerTrip IS NULL THEN 1 ELSE 0 END) AS null_avgActivitiesPerTrip,
  SUM(CASE WHEN avgCollaboratorsPerTrip IS NULL THEN 1 ELSE 0 END) AS null_avgCollaboratorsPerTrip,
  SUM(CASE WHEN avgTripDuration IS NULL THEN 1 ELSE 0 END) AS null_avgTripDuration,
  SUM(CASE WHEN followersCount IS NULL THEN 1 ELSE 0 END) AS null_followersCount,
  SUM(CASE WHEN followingCount IS NULL THEN 1 ELSE 0 END) AS null_followingCount,
  SUM(CASE WHEN gender IS NULL THEN 1 ELSE 0 END) AS null_gender,
  SUM(CASE WHEN ownedTripsCount IS NULL THEN 1 ELSE 0 END) AS null_ownedTripsCount,
  SUM(CASE WHEN totalActivitiesOwned IS NULL THEN 1 ELSE 0 END) AS null_totalActivitiesOwned,
  SUM(CASE WHEN totalCollaboratorsAcrossTrips IS NULL THEN 1 ELSE 0 END) AS null_totalCollaboratorsAcrossTrips,
  SUM(CASE WHEN totalTripDuration IS NULL THEN 1 ELSE 0 END) AS null_totalTripDuration,
  SUM(CASE WHEN totalTripsCompleted IS NULL THEN 1 ELSE 0 END) AS null_totalTripsCompleted,
  SUM(CASE WHEN totalTripsInProgress IS NULL THEN 1 ELSE 0 END) AS null_totalTripsInProgress,
  SUM(CASE WHEN totalTripsUpcoming IS NULL THEN 1 ELSE 0 END) AS null_totalTripsUpcoming,
  SUM(CASE WHEN accountCreatedAt IS NULL THEN 1 ELSE 0 END) AS null_accountCreatedAt,
  SUM(CASE WHEN lastActiveAt IS NULL THEN 1 ELSE 0 END) AS null_lastActiveAt
FROM atelic_analytics.user_profiles;

-- 15. Owned Trips Buckets (for histogram-like view)
SELECT
  CASE
    WHEN ownedTripsCount = 0 THEN '0'
    WHEN ownedTripsCount BETWEEN 1 AND 2 THEN '1-2'
    WHEN ownedTripsCount BETWEEN 3 AND 5 THEN '3-5'
    WHEN ownedTripsCount BETWEEN 6 AND 10 THEN '6-10'
    WHEN ownedTripsCount > 10 THEN '10+'
    ELSE 'Unknown'
  END AS owned_trips_bucket,
  COUNT(*) AS user_count
FROM atelic_analytics.user_profiles
GROUP BY
  CASE
    WHEN ownedTripsCount = 0 THEN '0'
    WHEN ownedTripsCount BETWEEN 1 AND 2 THEN '1-2'
    WHEN ownedTripsCount BETWEEN 3 AND 5 THEN '3-5'
    WHEN ownedTripsCount BETWEEN 6 AND 10 THEN '6-10'
    WHEN ownedTripsCount > 10 THEN '10+'
    ELSE 'Unknown'
  END
ORDER BY user_count DESC;

-- 16. Users Last Active by Day (last 30 days)
SELECT
  DATE_TRUNC('day', lastActiveAt) AS active_day,
  COUNT(*) AS users_last_active_that_day
FROM atelic_analytics.user_profiles
WHERE lastActiveAt >= CAST(date_add('day', -30, current_timestamp) AS TIMESTAMP)
GROUP BY DATE_TRUNC('day', lastActiveAt)
ORDER BY active_day;

-- 17. Percentiles for Key Metrics
SELECT
  approx_percentile(ownedTripsCount, 0.5) AS p50_trips,
  approx_percentile(ownedTripsCount, 0.9) AS p90_trips,
  approx_percentile(totalActivitiesOwned, 0.5) AS p50_activities,
  approx_percentile(totalActivitiesOwned, 0.9) AS p90_activities,
  approx_percentile(avgTripDuration, 0.5) AS p50_avg_trip_duration,
  approx_percentile(avgTripDuration, 0.9) AS p90_avg_trip_duration
FROM atelic_analytics.user_profiles;

-- 18. Top App Versions
SELECT
  appVersion,
  COUNT(*) AS user_count
FROM atelic_analytics.user_profiles
GROUP BY appVersion
ORDER BY user_count DESC
LIMIT 20;

-- 19. Age Groups vs Averages (trips, collaborators)
SELECT
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END AS age_group,
  COUNT(*) AS users,
  AVG(ownedTripsCount) AS avg_trips,
  AVG(totalCollaboratorsAcrossTrips) AS avg_collaborators
FROM atelic_analytics.user_profiles
GROUP BY
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END
ORDER BY users DESC;

-- 20. Helpful Views for QuickSight (use these as datasets)
CREATE OR REPLACE VIEW atelic_analytics.v_user_profiles AS
SELECT *
FROM atelic_analytics.user_profiles;

CREATE OR REPLACE VIEW atelic_analytics.v_user_profiles_age_groups AS
SELECT
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END AS age_group,
  COUNT(*) AS users,
  AVG(ownedTripsCount) AS avg_trips,
  AVG(avgActivitiesPerTrip) AS avg_activities_per_trip,
  AVG(avgCollaboratorsPerTrip) AS avg_collaborators_per_trip,
  AVG(avgTripDuration) AS avg_trip_duration
FROM atelic_analytics.user_profiles
GROUP BY
  CASE
    WHEN age < 18 THEN 'Under 18'
    WHEN age >= 18 AND age <= 24 THEN '18-24'
    WHEN age >= 25 AND age <= 34 THEN '25-34'
    WHEN age >= 35 AND age <= 44 THEN '35-44'
    WHEN age >= 45 AND age <= 54 THEN '45-54'
    WHEN age >= 55 THEN '55+'
    ELSE 'Unknown'
  END;

CREATE OR REPLACE VIEW atelic_analytics.v_user_profiles_app_versions AS
SELECT
  appVersion,
  COUNT(*) AS users
FROM atelic_analytics.user_profiles
GROUP BY appVersion;