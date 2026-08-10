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

### Purpose
- Home screen ke `Today's Jobs` list ko populate karne ke liye.
- Ye endpoint driver ke saare assigned jobs ya scheduled jobs return karega.

### Expected response shape
```json
{
  "success": true,
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
      "scheduledTime": "10:00 AM",
      "distance": "15.2 km",
      "billing": {
        "totalAmount": 450
      }
    }
  ]
}
```

### Notes
- `HomeScreen` mein `id` user visible job number ke liye ho sakta hai.
- Backend fetch ke liye actual `_id` bhi store karna chahiye agar details page par backend call karna hai.

---

## 3. Completed Jobs / Earnings
### Endpoint
`GET /jobs/driver/my-jobs?status=completed`

### Purpose
- Home screen statistics ke liye completed jobs count aur earnings dikhane ke liye.
- Agar dashboard mein `Earned` value chahiye toh is endpoint se calculate karein.

### Expected response shape
```json
{
  "success": true,
  "jobs": [ ... ]
}
```

---

## 4. Active Jobs Count
### Endpoint
`GET /jobs/driver/my-jobs?status=in_transit`

### Purpose
- Home screen pe active delivery count ya `Active` stat ke liye.
- Agar `started` status ko bhi active maana ho toh additional call ya status mapping use kiya ja sakta hai.

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

## 6. Notifications (Optional)
### Endpoint
`GET /notifications`

### Purpose
- Home screen bell icon ya unread notification count ke liye.
- Sirf use karein agar backend ye endpoint support karta ho.

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
