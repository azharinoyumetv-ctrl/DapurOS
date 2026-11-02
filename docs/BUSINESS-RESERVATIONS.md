# Business table reservations

In **Kasir**, select an empty table, choose **Reservasi meja**, and save the customer's name and party size. Phone number, expected arrival time and notes are optional. Cashiers, managers and owners can use this action when their DapurOS restaurant has Business access. Starter and Pro cannot create or edit reservations, including through a direct API request. The existing DapurOS trial policy is unchanged.

The table immediately shows **Direservasi** and the guest's name. This is one active hold per table, until staff seat the guest or cancel the reservation. An arrival time is informational and uses the device's time zone; it does not make a future calendar slot or automatically release the table. No dining bill, sale or stock movement is created when the reservation is saved.

Select the reserved table to edit the booking, choose **Tempatkan tamu & buka meja** when the guest arrives, or choose **Batalkan reservasi**. Seating opens the dining session with the saved guest snapshot. Dine-in orders inherit the guest name and phone unless the cashier explicitly supplies another customer. Reservations do not create customer accounts or send messages automatically.

Two cashiers cannot overwrite each other's booking. Updates, seating and cancellation check the reservation identity. A save retried after a lost response keeps the same request reference. A reserved table cannot be deleted, moved through a generic layout edit, or silently opened as an unrelated bill. Existing reservations can still be seated or cancelled after a paid downgrade; creation and editing require Business.

Reservation data uses the existing store-scoped tables, dining sessions and checkout audit collections. The existing account-erasure fence and product subscription isolation are preserved.

Verification uses disposable local databases and isolated Android fixture accounts. See [Android 1.0.4 verification](ANDROID-1.0.4-VERIFICATION.json) for the tested package and publication status.
