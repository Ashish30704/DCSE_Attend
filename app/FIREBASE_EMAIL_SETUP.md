# Enabling Firebase Auth Emails (Free)

This app uses **Firebase Authentication’s built-in email service** for:

- **Forgot password** – user gets an email with a reset link
- **Email verification** – new users get a link to verify their email

No SMTP, SendGrid, or other paid email service is required. Firebase sends these emails for you on the free tier.

---

## 1. Enable Email/Password sign-in

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Go to **Authentication** → **Sign-in method**.
3. Click **Email/Password**.
4. Turn **Enable** ON.
5. (Optional) Turn **Email link (passwordless sign-in)** OFF if you only want password sign-in.
6. Save.

---

## 2. Customize email templates (optional)

Firebase sends password-reset and verification emails from a default template. You can change the sender name and the email text.

1. In Firebase Console: **Authentication** → **Templates**.
2. You’ll see:
   - **Password reset** – used when the user clicks “Forgot password?” and enters their email.
   - **Email address verification** – used when a new user registers; they must click the link to verify.

For each template you can:

- **Sender name** – e.g. your app name instead of “noreply”.
- **Subject** – e.g. “Reset your password” or “Verify your email”.
- **Body** – edit the message (you can use placeholders like `%LINK%` and `%EMAIL%` as shown in the template).

No code changes are needed; the app keeps using `sendPasswordResetEmail()` and `sendEmailVerification()`.

---

## 3. Authorized domains (for web)

If you run the app on the web:

1. Go to **Authentication** → **Settings** → **Authorized domains**.
2. Add your web domain (e.g. `localhost` for dev, or your production domain).

Otherwise, password reset and verification links may be blocked.

---

## 4. What the user sees

- **Forgot password:** User enters email → Firebase sends an email with a link → user clicks it and sets a new password in the browser. After that they can sign in in the app with the new password.
- **New registration:** After sign-up, Firebase sends a verification email → user clicks the link → their account is marked verified. In the app they can click “I’ve verified” (or sign in again) to get full access.

All of this uses Firebase Auth’s free email delivery; no extra setup or paid plan is required.
