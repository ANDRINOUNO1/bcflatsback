# 🏠 BCFlats Room & Tenant Management API

This document provides comprehensive information about the Room and Tenant management APIs for the BCFlats application.

## 📋 Overview

The system manages:
- **Rooms**: 4 beds per room, with occupancy tracking
- **Tenants**: Student residents assigned to specific beds
- **Room Status**: Available, Partially Occupied, Fully Occupied, Maintenance, Reserved

## 🏠 Room Management API

### Base URL: `/api/rooms`

#### 1. Get Room Statistics
```http
GET /api/rooms/stats
```
**Response:**
```json
{
  "totalRooms": 24,
  "availableRooms": 6,
  "fullyOccupiedRooms": 12,
  "partiallyOccupiedRooms": 4,
  "maintenanceRooms": 2,
  "totalBeds": 96,
  "occupiedBeds": 76,
  "availableBeds": 20,
  "occupancyRate": 79
}
```

#### 2. Get Available Rooms
```http
GET /api/rooms/available
```
**Response:** Array of rooms with available beds

#### 3. Get All Rooms
```http
GET /api/rooms
Authorization: Bearer {token}
```
**Response:** Array of rooms with tenant information

#### 4. Get Room by ID
```http
GET /api/rooms/{id}
```
**Response:** Room details with tenant information

#### 5. Create Room (Admin/SuperAdmin only)
```http
POST /api/rooms
Authorization: Bearer {token}
```
**Body:**
```json
{
  "roomNumber": "101",
  "floor": 1,
  "building": "Main Building",
  "roomType": "Standard",
  "monthlyRent": 800.00,
  "utilities": 100.00,
  "description": "Ground floor room"
}
```

#### 6. Update Room (Admin/SuperAdmin only)
```http
PUT /api/rooms/{id}
Authorization: Bearer {token}
```

#### 7. Delete Room (Admin/SuperAdmin only)
```http
DELETE /api/rooms/{id}
Authorization: Bearer {token}
```

#### 8. Update Room Status
```http
PATCH /api/rooms/{id}/status
Authorization: Bearer {token}
```
**Body:**
```json
{
  "status": "Maintenance"
}
```

#### 9. Set Maintenance Mode (Admin/SuperAdmin only)
```http
PATCH /api/rooms/{id}/maintenance
Authorization: Bearer {token}
```
**Body:**
```json
{
  "maintenance": true,
  "reason": "Plumbing repair needed"
}
```

#### 10. Add Tenant to Room
```http
POST /api/rooms/{id}/tenants
Authorization: Bearer {token}
```
**Body:**
```json
{
  "accountId": 123,
  "bedNumber": 2,
  "monthlyRent": 200.00,
  "utilities": 25.00,
  "deposit": 100.00,
  "emergencyContact": {
    "name": "John Doe",
    "phone": "+1234567890",
    "relationship": "Parent"
  },
  "specialRequirements": "Allergic to peanuts"
}
```

#### 11. Remove Tenant from Room
```http
DELETE /api/rooms/{id}/tenants/{tenantId}
Authorization: Bearer {token}
```

#### 12. Get Room Tenants
```http
GET /api/rooms/{id}/tenants
Authorization: Bearer {token}
```

#### 13. Get Room Bed Status
```http
GET /api/rooms/{id}/beds
Authorization: Bearer {token}
```
**Response:**
```json
{
  "room": {
    "id": 1,
    "roomNumber": "101",
    "floor": 1,
    "building": "Main Building",
    "status": "Partially Occupied",
    "totalBeds": 4,
    "occupiedBeds": 2,
    "availableBeds": 2,
    "occupancyRate": 50
  },
  "bedStatus": [
    {
      "bedNumber": 1,
      "status": "Occupied",
      "tenant": {
        "id": 1,
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "checkInDate": "2024-01-15T00:00:00.000Z",
        "monthlyRent": 200.00,
        "utilities": 25.00
      }
    },
    {
      "bedNumber": 2,
      "status": "Occupied",
      "tenant": { ... }
    },
    {
      "bedNumber": 3,
      "status": "Available",
      "tenant": null
    },
    {
      "bedNumber": 4,
      "status": "Available",
      "tenant": null
    }
  ]
}
```

## 👥 Tenant Management API

### Base URL: `/api/tenants`

#### 1. Get Tenant Statistics
```http
GET /api/tenants/stats
```
**Response:**
```json
{
  "totalTenants": 76,
  "activeTenants": 72,
  "pendingTenants": 2,
  "checkedOutTenants": 2,
  "totalRevenue": 14400.00,
  "totalUtilities": 1800.00,
  "totalIncome": 16200.00
}
```

#### 2. Get All Tenants
```http
GET /api/tenants
Authorization: Bearer {token}
```

#### 3. Get Active Tenants
```http
GET /api/tenants/active
Authorization: Bearer {token}
```

#### 4. Get Tenant by ID
```http
GET /api/tenants/{id}
Authorization: Bearer {token}
```

#### 5. Create Tenant
```http
POST /api/tenants
Authorization: Bearer {token}
```
**Body:**
```json
{
  "accountId": 123,
  "roomId": 1,
  "bedNumber": 3,
  "monthlyRent": 200.00,
  "utilities": 25.00,
  "deposit": 100.00,
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "+1234567890",
    "relationship": "Parent"
  },
  "specialRequirements": "Vegetarian meals"
}
```

#### 6. Update Tenant
```http
PUT /api/tenants/{id}
Authorization: Bearer {token}
```

#### 7. Delete Tenant (Admin/SuperAdmin only)
```http
DELETE /api/tenants/{id}
Authorization: Bearer {token}
```

#### 8. Check In Tenant
```http
PATCH /api/tenants/{id}/checkin
Authorization: Bearer {token}
```

#### 9. Check Out Tenant
```http
PATCH /api/tenants/{id}/checkout
Authorization: Bearer {token}
```

#### 10. Update Tenant Status
```http
PATCH /api/tenants/{id}/status
Authorization: Bearer {token}
```
**Body:**
```json
{
  "status": "Active"
}
```

#### 11. Get Tenants by Account
```http
GET /api/tenants/search/account/{accountId}
Authorization: Bearer {token}
```

#### 12. Get Tenants by Room
```http
GET /api/tenants/search/room/{roomId}
Authorization: Bearer {token}
```

## 🔐 Authentication & Authorization

### Required Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Role-Based Access
- **Admin/SuperAdmin**: Full access to all operations
- **frontdeskUser**: Can manage tenants and room status
- **User**: Read-only access to public endpoints

## 📊 Room Structure

### Default Room Layout
- **Total Rooms**: 24 (6 floors × 4 rooms per floor)
- **Beds per Room**: 4 (fixed)
- **Room Numbers**: 101, 102, 103, 104, 201, 202, ..., 604

### Room Types
- **Standard**: Floors 1-4
- **Premium**: Floors 5-6

### Pricing Structure
- Base rent: $800
- Floor premium: +$50 per floor
- Room premium: +$25 per room number
- Example: Room 501 = $800 + $250 + $125 = $1,175

## 🚀 Usage Examples

### Adding a New Tenant
1. **Create Account** (if not exists)
2. **Find Available Room/Bed**
3. **Add Tenant to Room**
4. **Check In Tenant**

### Room Maintenance
1. **Set Room to Maintenance** (only if no active tenants)
2. **Perform Repairs**
3. **Set Room Back to Available**

### Tenant Checkout
1. **Check Out Tenant**
2. **Update Room Occupancy**
3. **Process Deposit Return**

## 🐛 Error Handling

All endpoints return appropriate HTTP status codes:
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **500**: Internal Server Error

Error responses include a message field:
```json
{
  "message": "Bed 2 is already occupied in this room"
}
```

## 🔧 Testing

### Test Room Creation
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "roomNumber": "999",
    "floor": 9,
    "building": "Test Building",
    "monthlyRent": 1000.00,
    "utilities": 150.00
  }'
```

### Test Tenant Assignment
```bash
curl -X POST http://localhost:3000/api/rooms/1/tenants \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": 1,
    "bedNumber": 1,
    "monthlyRent": 200.00,
    "utilities": 25.00
  }'
```

## 📝 Notes

- **Bed Numbers**: Always 1-4 per room
- **Room Status**: Automatically updated based on occupancy
- **Tenant Status**: Pending → Active → Checked Out
- **Data Validation**: Comprehensive validation on all inputs
- **Relationships**: Proper foreign key constraints and cascading
