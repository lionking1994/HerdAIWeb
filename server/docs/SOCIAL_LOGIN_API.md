# Social Login API Documentation

## Overview
This API endpoint handles both Google and Apple ID login/registration using authorization codes or identity tokens.

## Endpoint
```
POST /api/auth/social-login
```

## Request Body
```json
{
  "first_name": "Test",
  "last_name": "Name", 
  "email": "test@gmail.com",
  "authorization_code": "google_oauth_code_123_or_apple_identity_token_abc",
  "user_type": "google",
  "user_identifier": "android_device_id"
}
```

### Parameters
- `first_name` (string, required): User's first name
- `last_name` (string, required): User's last name  
- `email` (string, required): User's email address
- `authorization_code` (string, required): 
  - For Google: OAuth authorization code or ID token
  - For Apple: Identity token (JWT)
- `user_type` (string, required): Either "google" or "apple"
- `user_identifier` (string, optional): Device identifier for tracking

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "token": "jwt_token_here",
  "isNewUser": true,
  "user": {
    "id": 123,
    "name": "Test Name",
    "email": "test@gmail.com",
    "provider": "google",
    "provider_id": "google_user_id",
    "created_at": "2024-01-01T00:00:00.000Z",
    "registration_completed": false
  },
  "message": "User registered successfully"
}
```

### Error Response (400/500)
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Processing Logic

1. **Validation**: Validates required fields and email format
2. **Token Verification**:
   - **Google**: Uses Google Auth Library to verify ID token against Google's servers
   - **Apple**: Decodes JWT and validates against Apple's public keys, issuer, audience, and expiration
3. **User Lookup**: Checks if user exists by email
4. **User Creation/Login**:
   - If new user: Creates account with social provider info
   - If existing user: Updates login time
5. **Token Generation**: Creates JWT token for authentication
6. **Response**: Returns token, user data, and registration status

## Environment Variables Required

### For Google OAuth:
```env
GOOGLE_CLIENT_ID=your_google_client_id
```

### For Apple Sign In:
```env
APPLE_CLIENT_ID=your_apple_client_id
```

## Error Cases

- **Invalid authorization code**: Token verification fails
- **Email mismatch**: Token email doesn't match provided email
- **Missing required fields**: Required parameters not provided
- **Invalid user_type**: Must be "google" or "apple"
- **Token expired**: Apple token has expired
- **Invalid token format**: Malformed JWT token

## Security Features

- Verifies tokens against official provider endpoints
- Validates token issuer, audience, and expiration
- Checks email consistency between token and request
- Uses secure JWT generation for session management
- Sanitizes user data before database storage

## Usage Examples

### Google Login
```javascript
const response = await fetch('/api/auth/social-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@gmail.com',
    authorization_code: 'google_id_token_here',
    user_type: 'google',
    user_identifier: 'device_id_123'
  })
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('token', data.token);
  // Handle successful login
}
```

### Apple Login
```javascript
const response = await fetch('/api/auth/social-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@icloud.com',
    authorization_code: 'apple_identity_token_here',
    user_type: 'apple',
    user_identifier: 'ios_device_id_456'
  })
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('token', data.token);
  // Handle successful login
}
``` 