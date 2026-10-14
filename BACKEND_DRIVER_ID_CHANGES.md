# Backend Changes Specification: Driver ID Integration

This document outlines the exact changes required in the backend codebase (`api.deliveryplus.tech`) to generate, store, and return a unique **Driver ID** for driver partners in the DeliveryPlus ecosystem.

---

## 1. Executive Summary

- **Current State:** The authenticated user response from `GET /api/auth/me` returns standard user account data (`name`, `email`, `phone`, `role: "driver"`), but does **not** include a dedicated `driverId` or `driverCode`. Because of this, the mobile driver app currently displays:
  ```
  Driver ID: Not available
  ```
- **Desired State:** The backend assigns each driver a unique human-readable Driver ID (e.g., `DRV-00101` or `DP-10023`) and returns it in `GET /api/auth/me`, `POST /api/auth/login/driver`, and other auth/profile endpoints.

---

## 2. API Endpoints Requiring Changes

The following endpoints must include the `driverId` (or `driverCode`) in their response:

| Method | Endpoint | Description | Field to Add |
|---|---|---|---|
| `GET` | `/api/auth/me` | Fetches currently authenticated driver profile | `driverId` in `user` or root object |
| `POST` | `/api/auth/login/driver` | Driver login via email & password | `driverId` in `user` object |
| `POST` | `/api/auth/login` | General auth login fallback | `driverId` in `user` object |
| `POST` | `/api/auth/otp/verify` | Phone OTP authentication | `driverId` in `user` object |
| `GET` | `/api/driver/profile` | Driver profile details (if separate) | `driverId` in response |

---

## 3. Recommended JSON Response Format

### Example: `GET /api/auth/me`

#### Before:
```json
{
  "success": true,
  "message": "User profile fetched",
  "data": {
    "user": {
      "_id": "670a312bc89104b2819c9b3",
      "name": "Shivam",
      "email": "shivam2@gmail.com",
      "phone": "9717208313",
      "role": "driver",
      "isOnline": false
    }
  }
}
```

#### After (Add `driverId`):
```json
{
  "success": true,
  "message": "User profile fetched",
  "data": {
    "user": {
      "_id": "670a312bc89104b2819c9b3",
      "driverId": "DRV-00155",
      "name": "Shivam",
      "email": "shivam2@gmail.com",
      "phone": "9717208313",
      "role": "driver",
      "isOnline": false,
      "vehicle": null
    }
  }
}
```

> **Note on Accepted Key Names:**  
> The driver mobile app is already configured to accept any of the following field names:
> - `driverId` *(Recommended)*
> - `driverCode`
> - `driver_id`
> - `driverNumber`

---

## 4. Database Schema Changes (MongoDB / Mongoose Example)

### Option A: `User` Model (If drivers are stored in `User` collection)

In `models/User.js`:

```javascript
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  role: { type: String, enum: ['customer', 'driver', 'admin'], default: 'customer' },
  
  // ADD THIS FIELD:
  driverId: {
    type: String,
    unique: true,
    sparse: true, // sparse allows null/undefined for non-driver users
    trim: true,
  },

  // Other existing fields...
  isOnline: { type: Boolean, default: false },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
}, { timestamps: true });
```

---

### Option B: Auto-Generating Driver ID on Driver Creation

If you want the backend to automatically assign a sequential or unique code (e.g., `DRV-00101`, `DRV-00102`):

#### 1. Counter Collection or Count-based generation:
```javascript
// Pre-save hook in User.js or Driver.js
userSchema.pre('save', async function (next) {
  if (this.role === 'driver' && !this.driverId) {
    try {
      // Option 1: Sequence from counter collection
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'driverIdSeq' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.driverId = `DRV-${String(counter.seq).padStart(5, '0')}`;
    } catch (err) {
      // Option 2: Fallback to random uppercase 6-character code
      const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      this.driverId = `DRV-${randomCode}`;
    }
  }
  next();
});
```

---

## 5. Controller Updates (Express.js Example)

### In `controllers/authController.js`:

```javascript
// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('vehicle');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Ensure driverId is populated if driver profile is stored in a separate collection:
    let driverId = user.driverId;
    if (!driverId && user.role === 'driver') {
      const driverProfile = await DriverProfile.findOne({ user: user._id });
      driverId = driverProfile?.driverId || driverProfile?.driverCode || `DRV-${user._id.toString().slice(-5).toUpperCase()}`;
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          driverId: driverId || null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
```

### In `POST /api/auth/login/driver` (Login Controller):

Make sure the returned `user` payload also includes `driverId`:

```javascript
return res.status(200).json({
  success: true,
  message: 'Login successful',
  token: jwtToken,
  user: {
    _id: user._id,
    driverId: user.driverId || driverProfile?.driverId || null,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  },
});
```

---

## 6. Migration Script for Existing Drivers (One-Time Execution)

For existing drivers in the database who do not currently have a `driverId` (such as driver `shivam2@gmail.com`):

```javascript
// scripts/migrateDriverIds.js
const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateExistingDrivers() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const driversWithoutId = await User.find({
    role: 'driver',
    $or: [{ driverId: { $exists: false } }, { driverId: null }, { driverId: '' }],
  });

  console.log(`Found ${driversWithoutId.length} drivers needing a driverId.`);

  let startSeq = 101;
  for (const driver of driversWithoutId) {
    const driverId = `DRV-${String(startSeq++).padStart(5, '0')}`;
    driver.driverId = driverId;
    await driver.save();
    console.log(`Assigned ${driverId} to driver: ${driver.name} (${driver.email})`);
  }

  console.log('Migration completed successfully.');
  process.exit(0);
}

migrateExistingDrivers().catch(console.error);
```

---

## 7. How to Test & Verify

Once deployed to the backend server, run this cURL request with an active driver token:

```bash
curl -X GET "https://api.deliveryplus.tech/api/auth/me" \
  -H "Authorization: Bearer <DRIVER_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Expected Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "670a312bc89104b2819c9b3",
      "driverId": "DRV-00101",
      "name": "Shivam",
      "email": "shivam2@gmail.com",
      "phone": "9717208313",
      "role": "driver"
    }
  }
}
```

As soon as this response returns `"driverId"`, the mobile driver app will immediately display:
```
Driver ID: DRV-00101
```
instead of `Driver ID: Not available`.
