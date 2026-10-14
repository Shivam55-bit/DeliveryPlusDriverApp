# Home Screen API Reference

## Overview
Ye file `HomeScreen` ke liye zaroori backend API endpoints ko list karti hai. Isse aap samajh sakte hain kaunsa endpoint home screen pe job list, driver stats, aur notifications ke liye use hoga.

---

## 1. Driver Profile / Current User
### Endpoint
`GET /auth/me`

### Purpose
- Driver ka profile data le aata hai.
- Home screen mein driver name, phone, profile stats ya other user info dikhane ke liye.

### Expected response shape
```json
{
  "success": true,
  "user": {
    "_id": "...",
    "name": "Driver Name",
    "email": "driver@example.com",
    "phone": "1234567890"
  }
}
```

---

## 2. Job List
### Endpoint
`GET /jobs/driver/my-jobs`

The Driver App uses this driver-scoped endpoint on Home focus, Home pull-to-refresh,
Jobs tab focus, Jobs pull-to-refresh, and app resume. It does not fall back to
`GET /jobs/my-jobs` or the unscoped `GET /jobs`. A 404 or other request failure is
shown as a retryable load error and is not treated as an empty job list.

### Purpose
- Populate the authenticated driver's assigned-job collection and Home counters.
- Home's `Today's Jobs` section filters that collection by scheduled calendar date;
  future assignments remain available in the Jobs tab.

### Expected response shape
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "jobs": [
      {
        "_id": "6431...",
        "jobNumber": "JOB-101",
        "customerName": "Amit Sharma",
        "customerPhone": "9876543210",
        "pickupAddress": "Connaught Place",
        "dropAddress": "Gurgaon Sector 45",
        "jobType": "delivery",
        "status": "assigned",
        "scheduledDate": "2026-10-17T00:00:00.000Z",
        "scheduledTime": "10:00 AM",
        "distance": "15.2 km",
        "billing": {
          "totalAmount": 450
        }
      }
    ]
  }
}
```

### Notes
- `HomeScreen` mein `id` user visible job number ke liye ho sakta hai.
- Backend fetch ke liye actual `_id` bhi store karna chahiye agar details page par backend call karna hai.
- The response must contain a job array (`jobs`, `bookings`, `results`, `items`, or a
  nested `data` equivalent). An unrecognized response shape is a visible error, not
  an empty result.
- Assignment visibility requires an explicit matching authenticated user or driver
  profile ID in assignment collections. A server-provided `myAssignment` is accepted
  when its ID is omitted, because that object is already scoped to the authenticated
  driver by this endpoint. Driver display names are not used for matching.

---

## 3. Dashboard job statistics

Home derives assigned, in-progress, and completed counts from the same driver-scoped
job collection using each matched driver's assignment/work status. No separate
status-filtered request is required for the counters.

---

---

## 5. Optional: Dashboard Aggregated Endpoint
### Endpoint
`GET /driver/dashboard` (agar available ho)

### Purpose
- Agar backend ek consolidated dashboard endpoint provide karta hai, toh use prefer karein.
- Isse ek hi request mein stats aur job list mil sakte hain.

### Example response
```json
{
  "success": true,
  "profile": { /* auth/me data */ },
  "jobs": [ /* driver jobs */ ],
  "stats": {
    "assigned": 5,
    "inProgress": 2,
    "earnings": "₹4.5k"
  }
}
```

---

## 6. Notifications (Unavailable on deployed API)
### Endpoint
`GET /notifications`

The deployed API was probed with a read-only unauthenticated `GET` on
2026-10-13 and returned `404 Cannot GET /api/notifications`. The app therefore
does not issue notification-history or unread-count requests, and displays an
explicit unavailable state rather than an empty-success state. Implement this
feature only after the Driver API provides a documented driver-authorized route.

---

## Implementation Tips
- `JobsScreen` se `JobDetail` screen mein `backendId` ke saath navigate karein, taaki detail fetch mein backend `_id` use ho.
- Home screen mein offline toggle agar UI-only feature hai, toh backend call zaroori nahi.
- Agar backend `jobNumber` se request nahi accept karta, toh `backendId` ko request path mein use karein.

---

## Recommended Data Mapping
- `jobNumber` = display ID
- `_id` = backend fetch ID
- `customerName`, `customerPhone`, `pickupAddress`, `dropAddress`, `status`, `jobType`, `scheduledTime`, `distance`, `billing.totalAmount`
