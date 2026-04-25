ALTER TABLE "ReferralPayment" RENAME TO referral_payment;
ALTER TABLE "Lead" RENAME TO lead;
ALTER TABLE "User" RENAME TO "user";
-- Actually, let's just do ReferralPayment first as it's the one failing.
