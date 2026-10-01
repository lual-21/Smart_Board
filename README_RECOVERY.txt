SMART BOARD RECOVERY NOTES

This copy restores the original standalone board.html and repairs the classroom upgrade integration.

Important:
- .env.local is intentionally excluded from this ZIP. Add MONGODB_URI and JWT_SECRET in your local/Vercel environment.
- Do not commit secrets.
- Existing whiteboard files are preserved; classroom functionality is additive.

Main repairs:
- Restored original board.html standalone whiteboard.
- Fixed lib/auth.js cookie authentication and user lookup.
- Fixed classroom lookup by SB-XXXXXXXX classroom ID.
- Added /api/classrooms create/list/get/join/leave compatibility endpoints.
- Added /api/classrooms index GET/POST.
- Fixed classroom page query handling and login redirect.
- Fixed dashboard classroom links.
- Removed misplaced server-side classroom API copies from assets/js/api.
- Corrected package.json dependency versions to match package-lock.json.
