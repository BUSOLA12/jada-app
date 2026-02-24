# Admin Panel

Plain HTML/CSS/JavaScript admin interface for driver onboarding approvals.

## Setup

1. Open `admin-panel/js/firebase-config.js` and replace all `REPLACE_ME` values with your Firebase web app config.
2. Ensure admin users have custom claim: `admin: true`.
3. Host this folder on any static host (Firebase Hosting, nginx, etc).

## Pages

- `login.html` - admin sign-in
- `index.html` - dashboard
- `drivers.html` - list and filter drivers
- `driver-detail.html?id={uid}` - approval actions for one driver
- `trips.html`, `payments.html`, `settings.html` - placeholder pages

## Security

The UI checks custom claims, and Firestore/Storage rules must also enforce admin-only approval writes.
