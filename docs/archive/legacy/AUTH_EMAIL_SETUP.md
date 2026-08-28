# Authentication and Email Demo Setup

The application code is ready. Complete these account-level steps without placing secrets in source control or chat.

## 1. Create the local environment file

Copy `.env.example` to `.env.local`, then fill in:

```text
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH0_SSO_CONNECTION=equityiq-demo-okta

EMAIL_DELIVERY_MODE=test
RESEND_API_KEY=
EMAIL_FROM=EquityIQ <onboarding@resend.dev>
RESEND_TEST_RECIPIENT=
EMAIL_REPLY_TO=
```

Generate `AUTH0_SECRET` in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 2. Create the Auth0 application

1. Create an Auth0 **Regular Web Application**.
2. Add `http://localhost:3000/auth/callback` to **Allowed Callback URLs**.
3. Add `http://localhost:3000` to **Allowed Logout URLs** and **Allowed Web Origins**.
4. Copy the Auth0 domain, client ID, and client secret into `.env.local`.

When the Vercel URL is available, add its `/auth/callback` URL and origin to the same settings and change `APP_BASE_URL` in Vercel.

## 3. Enable Google

1. In Google Cloud, create an OAuth web client and configure the Auth0 tenant callback URL shown by the Auth0 Google connection. It normally has the form `https://YOUR_AUTH0_DOMAIN/login/callback`.
2. Enable the Google social connection in Auth0 and add the Google client ID and client secret.
3. Enable the connection for the EquityIQ Auth0 application.

The app uses the Auth0 connection name `google-oauth2`.

## 4. Enable LinkedIn

1. Create a LinkedIn account, Company Page, and developer application.
2. Enable LinkedIn OpenID Connect sign-in for that application.
3. Add the Auth0 tenant callback URL to the LinkedIn application.
4. Enable the LinkedIn social connection in Auth0 and enable it for EquityIQ.

The app expects the Auth0 connection name `linkedin`. Update the sign-in option if the connection is given a different name.

## 5. Enable company SSO for the demo

1. Create an Okta Integrator Free tenant and an OIDC web application.
2. Create an Auth0 enterprise OIDC connection named `equityiq-demo-okta` using the Okta issuer, client ID, and client secret.
3. Add the Auth0 tenant callback URL to the Okta application.
4. Enable the connection for the EquityIQ Auth0 application.

NASPP SSO can replace this connection later without changing the application flow.

## 6. Enable Resend test delivery

1. Create a Resend account and API key.
2. Set `RESEND_API_KEY` to that key.
3. Set `RESEND_TEST_RECIPIENT` to the email address used for the Resend account.
4. Keep `EMAIL_DELIVERY_MODE=test` and `EMAIL_FROM=EquityIQ <onboarding@resend.dev>`.

Test mode intentionally sends only to the configured Resend account inbox. After a domain is verified, change `EMAIL_DELIVERY_MODE` to `production`, set `EMAIL_FROM` to the verified sender, and the UI will accept employee recipient addresses.

## 7. Verify the demo

1. Start the application with `npm.cmd run dev`.
2. Confirm Google, LinkedIn, and company SSO each return to EquityIQ as a signed-in user.
3. Generate a draft and click **Email**.
4. Confirm the email arrives at the masked demo inbox with a non-empty branded PDF attachment.
5. Sign out and confirm the library, drafts, search, and Brain remain available.
