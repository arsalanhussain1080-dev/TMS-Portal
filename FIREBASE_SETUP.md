# TMS Firebase integration checklist

Firebase project ID: `tss-admin-portal-1f3fa` (new project visible in user's screenshots). Do not confuse with `tss-admin-portal` or the separate TAH project.

## Current scope
This repository contains **draft Firestore rules**. Creating this file does **not** deploy the rules. Firebase console is unchanged.

## Admin bootstrap (manual, verified owner only)
1. In Firebase Authentication, create the first authorized admin email/password account.
2. Copy its exact Firebase Authentication UID.
3. Create `admins/{AUTH_UID}` with `active: true` (boolean). Never use `test-admin` as an actual admin.
4. Remove temporary `admins/test-admin` and `Students/test-student` after verifying no application depends on them.
5. Deploy `firestore.rules` only after reviewing and testing in the Firebase emulator.

## Data model
- `admins/{uid}`: `active: boolean`
- `Students/{uid}`: `name: string`, `role: "student"`, `active: boolean`
- `courseCatalog/batch1`: course lecture access metadata (schema to be finalized before activation)
- `deviceLocks/{uid}`: server-controlled device registration only
- `auditLogs/{id}`: server-written audit events

## Security boundary
All account creation, suspension, device reset, course mutation, and signed video access require authenticated backend endpoints using verified Firebase ID tokens and Firebase Admin SDK. The client must never contain service account keys, Bunny signing keys, hardcoded passwords, or client-enforced security decisions. Current admin/student previews are not production auth systems. Never enable open Firestore write rules to make a preview work.

## Before production
- Register the Vercel domain in Authentication authorized domains if required by auth flow.
- Configure Firebase client config for the **new** project.
- Store Admin SDK credentials and video signing secrets only in server-side Vercel environment variables.
- Add server endpoints, verify roles, implement device lock/reset and signed video playback.
- Test admin/student access, suspension, lecture lock, device reset, and unauthenticated access.
- Merge the reviewed branch only after tests pass.
