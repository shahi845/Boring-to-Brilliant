# Online fee payments

Students pay from **Fees → Status → Pay now**. There are three ways to pay:

| Way | How it works | Who confirms |
|---|---|---|
| **Razorpay** (UPI, cards, net banking, wallets) | Razorpay's official checkout opens over the page. The API server creates the order with the amount from the database and checks Razorpay's signature afterwards. | Automatic: the fee is marked **Paid** and a receipt is issued |
| **Direct UPI** to the college's own UPI ID | Real UPI QR code + "Open UPI app" link (`upi://pay?…`). The student then enters the 12-digit UTR. | The Admin, under **Fees → Online Payments** (Confirm / Reject) |
| **At the office** | The Admin uses **Record payment** as before. | The Admin |

Every step is saved in Supabase (`records`, collection `payments`), and the Admin can download
**Payments** and **Fees** backups as CSV from **Fees → Online Payments**.

## Setup

1. **Direct UPI:** Admin → **Settings → Payments**. Enter the college UPI ID and the account name, then save.
   Pay ₹1 to the preview QR from your own phone to check it shows the right name.
2. **Razorpay:** create an account at dashboard.razorpay.com. Under *Account & Settings → API Keys*, generate **test** keys first.
   In Vercel → Settings → Environment Variables, add:
   - `RAZORPAY_KEY_ID` = `rzp_test_…` (type: Config)
   - `RAZORPAY_KEY_SECRET` = the key secret (type: **Secret**)

   Redeploy. **Settings → Payments** then shows "Connected · TEST mode". Test with Razorpay's test cards or test UPI (`success@razorpay`).
3. **Going live:** after Razorpay approves the college's KYC, swap the two values for the `rzp_live_…` keys and redeploy.

The secret key only ever lives on the server. Card and bank details are entered in Razorpay's window and never reach OURCAMPUS.
Razorpay charges about 2% per payment; direct UPI has no charges.

## Charging a whole class

Admin → **Fees → Assign Fee** → *Whole class · Degree I*, a name (e.g. "Class trip") and an amount (e.g. ₹20).
Every student in the class gets a notification ("New fee: Class trip · ₹20 … tap to pay online") and a **Pay now** button.
