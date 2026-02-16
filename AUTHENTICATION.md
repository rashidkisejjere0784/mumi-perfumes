# Login & Authentication System - Mumi Perfumes POS

## Overview

The system now includes a complete authentication system with user management, role-based access control, and secure session handling.

---

## Default Credentials

**Username:** `admin`  
**Password:** `admin123`

⚠️ **Important:** For security reasons, the default credentials are NOT displayed on the login page. Store these credentials securely and change the password immediately after first login!

---

## Features

### 1. User Authentication
- ✅ Secure login with username and password
- ✅ Password hashing with bcrypt
- ✅ JWT token-based sessions
- ✅ HttpOnly cookies for security
- ✅ Automatic session expiry (7 days)
- ✅ Protected routes (redirect to login if not authenticated)

### 2. User Management (Admin Only)
- ✅ Create new users
- ✅ Edit user details
- ✅ Change passwords
- ✅ Activate/deactivate users
- ✅ Assign roles (User or Admin)
- ✅ Delete users (except yourself)
- ✅ View last login time

### 3. Role-Based Access Control
- **Admin Role:**
  - Full access to all features
  - User management page
  - Can create/edit/delete users
  - Can assign roles
  
- **User Role:**
  - Access to all POS features
  - Cannot access user management
  - Cannot change their own role

---

## How to Use

### First Time Login

1. Open http://localhost:3000
2. You'll be redirected to the login page
3. Enter the default credentials (not shown on screen for security):
   - Username: `admin`
   - Password: `admin123`
4. Click **Login**
5. You'll be redirected to the dashboard
6. **Immediately change your password** by going to Users → Edit admin

### Changing Your Password

1. Go to **Users** page (in sidebar, admin only)
2. Click the edit icon next to your username
3. Enter a new password
4. Click **Update User**

### Creating New Users

1. Go to **Users** page
2. Click **Add User**
3. Fill in:
   - Full Name
   - Username (unique)
   - Password
   - Role (User or Admin)
4. Click **Create User**

### Logging Out

Click the **Logout** button at the bottom of the sidebar.

---

### Security Features

### Password Security
- Passwords are hashed using bcrypt (10 rounds)
- Original passwords are never stored
- Passwords cannot be retrieved (only reset)
- Default credentials not displayed on login page

### Session Security
- JWT tokens with 7-day expiration
- HttpOnly cookies (not accessible via JavaScript)
- SameSite=Strict (prevents CSRF attacks)
- Automatic token validation on each request

### API Security
- All API routes validate authentication
- Admin-only endpoints check user role
- Users cannot delete themselves
- Users cannot change their own role (unless admin)

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);
```

### User Roles
- `admin` - Full system access
- `user` - Standard POS access

---

## API Endpoints

### Authentication

```
POST /api/auth/login
Body: { username, password }
Response: { message, user }
```

```
POST /api/auth/logout
Response: { message }
```

```
GET /api/auth/me
Response: { user }
```

### User Management (Admin Only)

```
GET /api/users
Response: User[]
```

```
POST /api/users
Body: { username, password, full_name, role }
Response: User
```

```
PUT /api/users
Body: { id, username?, full_name?, role?, is_active?, password? }
Response: User
```

```
DELETE /api/users?id={id}
Response: { message }
```

---

## Environment Variables

The system uses environment variables for configuration:

```env
# .env.local
JWT_SECRET=your-secret-key-here
```

⚠️ **Production Tip:** Change the JWT_SECRET to a strong random string in production!

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Middleware

The system uses Next.js middleware to protect routes:

- `/login` - Public (redirects to dashboard if authenticated)
- All other routes - Protected (redirects to login if not authenticated)
- API routes - Validate JWT token

Located at: `middleware.ts`

---

## Components

### AuthProvider
- Context provider for authentication state
- Manages user session
- Provides login/logout functions
- Located at: `components/AuthProvider.tsx`

### ProtectedRoute
- Wrapper component for protected pages
- Shows loading state while checking auth
- Redirects to login if not authenticated
- Located at: `components/ProtectedRoute.tsx`

---

## Password Reset

To reset a user's password:

1. **As Admin:**
   - Go to Users page
   - Click edit on the user
   - Enter new password
   - Click Update User

2. **As User (yourself):**
   - Ask an admin to reset your password
   - Or use the database directly (see below)

### Manual Password Reset (Database)

If you're locked out, you can reset via database:

```javascript
// Run in Node.js
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const db = new Database('mumi_perfumes.db');

const newPassword = 'newpassword123';
const hash = bcrypt.hashSync(newPassword, 10);

db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
  .run(hash, 'admin');

console.log('Password reset successfully!');
```

---

## Troubleshooting

### Cannot Login
- Check credentials are correct
- Verify user is active (is_active = 1)
- Check browser console for errors
- Clear browser cookies and try again

### Redirected to Login Repeatedly
- Check if cookies are enabled in browser
- Verify JWT_SECRET is set correctly
- Check middleware configuration

### "Unauthorized" Error
- Your session may have expired (7 days)
- Login again
- Check if your user account is active

---

## Best Practices

1. **Change Default Password:**
   - Immediately change admin password on first login

2. **Use Strong Passwords:**
   - Minimum 8 characters
   - Mix of letters, numbers, and symbols
   - Don't reuse passwords

3. **Limit Admin Accounts:**
   - Only create admin accounts for trusted users
   - Most users should have "user" role

4. **Regular Review:**
   - Periodically review user list
   - Deactivate unused accounts
   - Check last login times

5. **Secure JWT Secret:**
   - Use a strong random string
   - Never commit to version control
   - Keep .env.local file secure

---

## Future Enhancements

Possible additions:
- Password complexity requirements
- Password reset via email
- Two-factor authentication (2FA)
- Session timeout settings
- Activity logging
- Password expiry policy
- Account lockout after failed attempts

---

## Support

For issues or questions about authentication:
1. Check this documentation
2. Review browser console for errors
3. Check server logs
4. Verify database integrity

---

**Version:** 1.0.0 with Authentication  
**Last Updated:** February 15, 2026
