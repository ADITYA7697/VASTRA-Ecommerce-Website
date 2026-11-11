# बदलाव — VASTRA

- Email/password authentication के JWT में issuer/audience validation जोड़ी।
- Razorpay online payment order creation और server-side signature/status/amount verification जोड़ा।
- Server-calculated payment intent snapshot, duplicate payment protection, paid order creation और stock checks जोड़े।
- Checkout में COD के साथ Razorpay online payment option जोड़ा; provider configuration न होने पर online option बंद रहता है।
- `.env.example` में Razorpay key placeholders और Hindi setup notes जोड़े।
- किसी वास्तविक `.env`, API secret या payment credential को ZIP में शामिल नहीं किया गया।

- My Orders पेज में order history, order detail shortcut और responsive order cards बेहतर किए।
- डिलीवरी के बाद 7 दिनों के भीतर return request भेजने का फीचर जोड़ा; कारण/नोट, duplicate request रोकथाम और server-side eligibility checks शामिल हैं।
- Return requests ऑर्डर के साथ सुरक्षित रूप से सेव होती हैं; admin review workflow/approval UI अभी अलग से जोड़ना बाकी है।


## Account & Cart UI refinement
- Signup में नाम, ईमेल, मोबाइल नंबर और पासवर्ड अनिवार्य किए।
- Empty cart का बड़ा आइकन छोटा किया और account dashboard/cart के लिए responsive professional styling जोड़ी।
