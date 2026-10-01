# VERBAS Netlify Frontend

This frontend was generated from the supplied StartupLabBook_Professional ZIP and converted from server-rendered Jinja pages into a static API frontend.

## Architecture
Netlify frontend -> Render Flask API -> Aiven MySQL

API base is configured in `assets/js/config.js`:
`https://verbas-backend.onrender.com`

## Routes
- `#/login` employee login
- `#/admin-login` admin login
- `#/employee` employee dashboard
- `#/admin` admin dashboard
- `#/employees` employee management

## Deploy
Upload this folder to a GitHub repository and connect it to Netlify. Publish directory is the repository root.

Do not put Aiven/MySQL credentials in this frontend.
