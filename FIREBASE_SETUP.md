# TMS Firebase setup

The TMS Student Portal is at `/`. The Admin Dashboard is at `/admin/`.
The Firebase Web SDK uses the registered TMS app in `tss-admin-portal-1f3fa`.
Server APIs require `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY` in the Vercel server environment. Keep the service
account key out of Git and the browser.

## Isolated testing

1. Install the repository dependencies, then start the Auth and Firestore
   emulators with `npx firebase-tools emulators:start --project demo-tms-portal --only auth,firestore`.
2. Run the Vercel dev server on loopback with
   `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and
   `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` set for its process.
   The browser Auth client connects to the Auth emulator on loopback.
3. Seed an emulator-only email/password user and a matching Firestore
   `admins/{uid}` document with `active: true`.
4. From the dashboard, create an emulator student, open the one-time setup
   link, and use the resulting account in the Student Portal. Check that a
   second browser is rejected until the admin resets the device. Sign in
   again after reset and confirm that the next browser can register.
5. Suspend and reactivate the student. Lock and unlock a lecture and verify
   both the student list and the video authorization endpoint. With test video
   configuration, an unlocked assigned lecture returns a signed embed URL.

Vercel previews refuse account changes, lecture changes and device enrollment
against the shared Firebase project. They can read authorized data if a server
connection has been configured. Preview sign-in pages use the same Firebase
web app as the eventual release.

## Production review

- Verify the intended first admin's UID and `admins/{uid}.active` in TMS.
- Review the deployed Firestore rules before replacing them. The prototype
  rules in this branch deny all direct client reads and writes because the
  signed-in portal uses server APIs for all Firestore access.
- Confirm the Email/Password provider, authorized domains where applicable,
  and the server credentials for the production deployment.
- Enable Embed View Token Authentication in the TMS Bunny Stream library.
  Set the server-only Vercel values `BUNNY_STREAM_LIBRARY_ID`,
  `BUNNY_STREAM_EMBED_TOKEN_KEY`, and `BUNNY_STREAM_VIDEO_IDS`. The last
  value is a JSON object mapping zero-based node and lecture numbers (for
  example, `"0:0"`) to Bunny Stream video UUIDs. Verify direct media access
  is restricted in Bunny and confirm playback from the intended domain.
- Rotate any passwords previously embedded in the public portal source before
  bringing those students onto Firebase.
