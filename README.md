# BCFlats Backend

A Node.js/Express backend API for the BCFlats application with JWT authentication and MySQL database.

## 🚀 Features

- **JWT Authentication** with role-based access control
- **MySQL Database** with Sequelize ORM
- **User Management** (CRUD operations)
- **Role-based Authorization** (Admin, SuperAdmin, User, Owner, frontdeskUser)
- **Password Hashing** with bcrypt
- **CORS enabled** for frontend integration
- **Error Handling** middleware
- **Automatic Database Seeding** on startup

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd kys/bcflatsback
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure database**
   - Create a MySQL database named `bcflats`
   - Update `config.json` with your database credentials

4. **Start the backend**
   ```bash
   npm run dev
   ```

   The backend will automatically:
   - Connect to MySQL database
   - Create necessary tables
   - Seed initial admin user
   - Start server on port 3000

## 🗄️ Database Setup

1. **Create MySQL database:**
   ```sql
   CREATE DATABASE bcflats;
   ```

2. **Update config.json** with your database credentials:
   ```json
   {
     "db": {
       "host": "localhost",
       "port": 3306,
       "database": "bcflats",
       "username": "your_username",
       "password": "your_password"
     }
   }
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on port 3000 (configurable in `config.json`).

## 📡 API Endpoints

### Authentication
- `POST /api/accounts/authenticate` - User login
- `POST /api/accounts/register` - User registration

### User Management
- `GET /api/accounts` - Get all users (Admin only)
- `GET /api/accounts/:id` - Get user by ID
- `PUT /api/accounts/:id` - Update user profile
- `DELETE /api/accounts/:id` - Delete user (Admin only)

### Health Check
- `GET /api/health` - Server status

## 👥 Default Users

After running the backend, this account is automatically created:

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `admin123` | Admin |

## 🔐 JWT Configuration

- **Secret**: Configured in `config.json`
- **Expiration**: 7 days
- **Algorithm**: HS256

## 🛡️ Security Features

- Password hashing with bcrypt (10 rounds)
- JWT token validation
- Role-based access control
- CORS protection
- Input validation

## 📁 Project Structure

```
bcflatsback/
├── account/              # User account management
│   ├── account.controller.js
│   ├── account.model.js
│   ├── account.service.js
│   └── refresh-token.model.js
├── booking/              # Booking management
│   ├── booking.model.js
│   └── archive.model.js
├── rooms/                # Room management
│   ├── room.model.js
│   ├── room-type.model.js
│   └── room-occupancy.model.js
├── contact-messages/     # Contact form messages
│   └── contact-message.model.js
├── _helpers/            # Helper functions and database
│   ├── db.js           # Database configuration
│   └── role.js         # Role definitions
├── _middleware/         # Express middleware
│   ├── authorize.js     # JWT authorization
│   └── error-handler.js # Error handling
├── config.json          # Configuration file
├── start.js             # Startup script
└── server.js            # Express server
```

## 🔧 Environment Variables

Create a `.env` file for sensitive data:
```env
JWT_SECRET=your-super-secret-jwt-key
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bcflats
DB_USER=your_username
DB_PASS=your_password
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service is running
   - Verify database credentials in `config.json`
   - Ensure database `bcflats` exists

2. **Port Already in Use**
   - Change port in `config.json`
   - Kill process using the port: `npx kill-port 3000`

3. **JWT Token Issues**
   - Check JWT secret in `config.json`
   - Verify token expiration

### Testing Commands:

```bash
# Test backend connection
cd kys/bcflatsback
npm run test

# Check backend health
curl http://localhost:3000/api/health
```

## 🤝 Frontend Integration

The backend is configured to work with the BCFlats frontend:
- CORS enabled for `http://localhost:4200` (Angular dev server)
- API base URL: `http://localhost:3000/api`
- JWT tokens stored in localStorage

## 📝 License

This project is part of the BCFlats application.