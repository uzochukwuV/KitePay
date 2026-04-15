Payouts
The Payouts API allows you to convert crypto assets (BTC, USDT, USDC) into local fiat currencies (e.g., NGN, KES). The flow involves creating a quote, initializing the payout with beneficiary details, depositing funds, and finalizing the transaction.

Payouts API Endpoints
API Endpoints

POST /api/payouts/quotes
POST /api/payouts/quotes/:quoteId/initialize
POST /api/payouts/beneficiary-lookup
POST /api/payouts/simulate-deposit
POST /api/payouts/quotes/:quoteId/finalize
GET /api/payouts/quotes/{quoteId}
GET /api/payouts/fetch/{id}
GET /api/payouts/fetch/reference/{reference}
GET /api/payouts/supported-countries/:countryCode/requirements
GET /api/payouts/supported-countries
Create Payouts Quote
Creates a quote for converting cryptocurrency to fiat. You can specify either amount (crypto amount) or settlement_amount (target fiat amount).

Create Payouts Quote
http

POST /api/payouts/quotes
Create Payouts Quote Request
1
from_asset
string
Required
The crypto asset to convert from (e.g., BTC, USDT, USDC).

2
to_currency
string
Required
The target fiat currency code (e.g., NGN, KES).

3
source
string
Required
The source of funds. Use `onchain` for blockchain deposit or `offchain` for wallet balance.

4
chain
string
Optional
The blockchain network (e.g., BITCOIN, trc20, erc20). Required when source is `onchain`.

5
amount
string
Required if settlement_amount not provided
The crypto amount to convert. Takes priority over settlement_amount if both are provided.

6
settlement_amount
string
Required if amount not provided
The target fiat amount to receive. Ignored if amount is also provided.

7
payment_reason
string
Required
Description of the payment purpose.

8
reference
string
Required
Your unique reference for this quote.

9
client_meta_data
string
JSON string of custom metadata for internal tracking.

10
country
string
Required
Two-letter ISO country code for the destination (e.g., NG, KE).

Note
One of either amount or settlement_amount must be provided. If both are provided, amount takes priority.

Create Payouts Quote
cURL

curl --request POST \
  --url https://api.bitnob.com/api/payouts/quotes \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }' \
  --data '{
    "from_asset": "BTC",
    "to_currency": "NGN",
    "source": "onchain",
    "chain": "BITCOIN",
    "amount": "0.0015",
    "payment_reason": "Vendor payout",
    "reference": "offramp-quote-001",
    "client_meta_data": "{\"invoice_id\":\"INV-1001\"}",
    "country": "NG"
  }'
Create Payouts Quote Response
1
id
string
A globally unique identifier for the quote. This ID can be used to reference the quote in future payout requests or for auditing and logging purposes.

2
status
string
The current state of the quote. Typically set to 'quote', but may include other statuses depending on the lifecycle (e.g., expired, used).

3
settlement_currency
string
The fiat currency that the recipient will receive after the crypto-to-fiat conversion. Example: 'NGN' for Nigerian Naira.

4
exchange_rate
number
The calculated conversion rate used to determine how much fiat will be received per unit of crypto. This rate is time-sensitive and may vary across quotes.

5
quote_id
string
An internal reference string for the quote that can be passed into subsequent payout endpoints. Helps in tracking and verifying quote integrity during processing.

6
settlement_amount
number
The exact amount of fiat the user will receive, calculated based on the crypto amount and exchange rate. This is the final payout value to the end user.

7
amount
number
The original crypto amount provided in the quote request.

8
btc_rate
number
Represents the Bitcoin to fiat exchange rate at the time of quote generation.

9
sat_amount
number
The equivalent amount in satoshis for the requested crypto amount.

10
expiry_timestamp
number
The UNIX timestamp (in seconds) indicating when this quote will become invalid. After this time, the quote must be re-generated to reflect updated rates.

11
expires_in_text
string
A human-readable message showing how long the quote is valid. Common formats include 'This quote expires in 15 minutes'.

12
quote_text
string
A user-friendly summary of the quote details, such as 'NGN 327,202 will be settled for this transaction'. Often shown directly in UI confirmations.

Create Payouts Quote - Response
json

{
    "status": "success",
    "message": "Payouts quote generated successfully",
    "data": {
        "id": "5ddbcd32-3647-4d0a-b1fb-e4769bb9bf04",
        "status": "quote",
        "settlement_currency": "NGN",
        "quote_id": "QT_120732",
        "settlement_amount": 32664,
        "btc_rate": 112240.9,
        "exchange_rate": 1633.2,
        "expiry_timestamp": 1757373541,
        "amount": "0.0015",
        "sat_amount": 17819,
        "expires_in_text": "This quote expires in 15 minutes",
        "quote_text": "NGN 32,664 will be settled for this transaction"
    }
}
Initialize Payout
Initializes a payout after a quote has been created. The beneficiary field is a freeform object — use GET /api/payouts/supported-countries/:countryCode/requirements to know the exact fields required for each country.

Initialize Payout
http

POST /api/payouts/quotes/:quoteId/initialize
Initialize Payout - Path Parameters
1
quoteId
string
Required
The ID of the quote to initialize.

Initialize Payout - Request Body
1
customer_id
string
Required
Unique identifier for the customer initiating the transaction.

2
beneficiary
object
Required
Bank or wallet details of the recipient. Structure varies by country — use the GET /api/payouts/supported-countries/:countryCode/requirements endpoint to retrieve the correct fields.

3
reference
string
Required
Unique reference for this transaction.

4
payment_reason
string
Required
Reason or description of the payment.

5
client_meta_data
string
JSON string of additional metadata.

6
callback_url
string
Webhook URL for transaction status updates.

Initialize Payout - Request
cURL

curl --request POST \
  --url https://api.bitnob.com/api/payouts/quotes/{quoteId}/initialize \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }' \
  --data '{
    "customer_id": "8c8b0b31-0b5f-4a4e-9e43-18b4f9a62c11",
    "beneficiary": {
      "account_number": "0123456789",
      "bank_code": "058",
      "account_name": "Ada Okafor"
    },
    "reference": "offramp-init-001",
    "client_meta_data": "{\"batch\":\"march-payouts\"}",
    "payment_reason": "Supplier settlement",
    "callback_url": "https://example.com/webhooks/payouts"
  }'
Initialize Payout - Response
1
fees
number
Any fees applied to the payout transaction. A value of 0 means no fees were charged for this transaction.

2
id
string
A unique identifier assigned to the payouts transaction. You can use this ID for tracking or referencing the transaction in future API calls.

3
address
string
The cryptocurrency deposit address where the user should send funds. Only applicable for on-chain payments.

4
chain
string
The blockchain network to be used for the transaction. Examples include trc20, erc20, BITCOIN, depending on the selected from_asset.

5
status
string
The current state of the payouts transaction. Values can include initiated, pending, completed, or failed.

6
payment_eta
string
An estimate of how long it will take for the fiat payout to reach the beneficiary after the transaction is confirmed.

7
reference
string
The unique reference passed during initialization. Useful for reconciliation or auditing purposes.

8
from_asset
string
The cryptocurrency asset being converted in the payouts transaction, such as USDT, USDC, or BTC.

9
quote_id
string
The identifier of the quote that was previously generated and used to initialize this transaction.

10
payment_reason
string
A description or note about the purpose of the payment.

11
settlement_currency
string
The fiat currency the user will receive in the payout (e.g., NGN, KES).

12
exchange_rate
number
The rate at which the selected from_asset is converted into the settlement fiat currency. This rate was locked during quote generation.

13
expiry_timestamp
number
A UNIX timestamp representing when the initialization request or quote will expire. After this, a new quote will be required.

14
amount
number
The original crypto amount to be paid by the customer.

15
btc_amount
number
The equivalent amount of the crypto asset in BTC, used for internal calculations or when the user is paying in BTC.

16
sat_amount
number
The equivalent Bitcoin amount in satoshis (1 BTC = 100,000,000 satoshis). Useful when using precise crypto payments.

17
expires_in_text
string
A human-readable string showing how much time is left before the transaction or quote expires.

18
beneficiary_details
object
Contains all verified and saved information about the payout beneficiary. Fields include: id, status (e.g., success, pending), country (ISO code), currency (e.g., NGN), created_at, updated_at, reference, and destination (account details).

19
destination
object
Contains the actual payout account details. Fields include: type (e.g., BANK), bank_code, account_name, and account_number.

20
settlement_amount
number
The total amount the beneficiary will receive in their local fiat currency after all conversions and fees.

Initialize Payout - Response
json

{
  "status": "success",
  "message": "Payouts quote initialized successfully",
  "data": {
    "fees": 0,
    "id": "4c281868-7b0d-4c4f-bcd7-bb3bbc9248bc",
    "address": "TNgGpCkphycU4pLg2LSJGUdb1mdwgMP8xs",
    "chain": "trc20",
    "status": "initiated",
    "payment_eta": "3-5 minutes",
    "reference": "offramp-init-001",
    "from_asset": "USDT",
    "quote_id": "QT_6158",
    "payment_reason": "Supplier settlement",
    "settlement_currency": "NGN",
    "exchange_rate": 1636.21,
    "expiry_timestamp": 1736952410,
    "amount": "0.0015",
    "btc_amount": 0.00201816,
    "sat_amount": 201816,
    "expires_in_text": "This invoice expires in 15 minutes",
    "beneficiary_details": {
      "id": "41b1e004-ce45-4591-bebe-6a2debcf05fd",
      "status": "success",
      "country": "NG",
      "currency": "NGN",
      "created_at": "2025-01-15T14:30:48.773Z",
      "reference": "QT_6158_24ccd39d2345",
      "updated_at": "2025-01-15T14:30:48.773Z",
      "destination": {
        "type": "BANK",
        "bank_code": "000014",
        "account_name": "ADA OKAFOR",
        "account_number": "0123456789"
      }
    },
    "settlement_amount": 327242
  }
}
Beneficiary Lookup
Looks up and validates beneficiary account details before initiating a payout. Use this to confirm that the account number and bank code are valid for the given country.

Beneficiary Lookup
http

POST /api/payouts/beneficiary-lookup
Beneficiary Lookup Request
1
country
string
Required
Two-letter ISO country code (e.g., NG, KE).

2
account_number
string
Required
The beneficiary's account number.

3
bank_code
string
Required
The bank code for the account.

4
type
string
Required
The account type (e.g., bank_account).

Beneficiary Lookup - Request
cURL

curl --request POST \
  --url https://api.bitnob.com/api/payouts/beneficiary-lookup \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }' \
  --data '{
    "country": "NG",
    "account_number": "0123456789",
    "bank_code": "058",
    "type": "bank_account"
  }'
Beneficiary Lookup Response
1
status
string
Indicates whether the lookup was successful.

2
account_name
string
The name registered to the provided account number.

3
account_number
string
The validated account number.

4
bank_code
string
The bank code associated with the account.

Beneficiary Lookup - Response
json

{
  "status": "success",
  "message": "Beneficiary account verified successfully",
  "data": {
    "account_name": "ADA OKAFOR",
    "account_number": "0123456789",
    "bank_code": "058"
  }
}
Simulate Deposit
Simulates a crypto deposit for testing purposes. Only available in the sandbox environment.

Simulate Deposit
http

POST /api/payouts/simulate-deposit
Simulate Deposit Request
1
quote_id
string
Required
The ID of the quote to simulate deposit for.

2
amount
string
Required
The amount of crypto to simulate.

3
tx_hash
string
Required
A simulated transaction hash.

Simulate Deposit - Request
cURL

curl --request POST \
  --url https://api.bitnob.com/api/payouts/simulate-deposit \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }' \
  --data '{
    "quote_id": "0c6c9f5f-7a20-467d-a92a-1e15f2b7c6f1",
    "amount": "0.0015",
    "tx_hash": "2d5f6f0c7a4b..."
  }'
Simulate Deposit Response
1
status
string
Indicates whether the simulation request was successful.

2
message
string
A human-readable message describing the result of the simulation.

3
success
boolean
Indicates whether the simulated deposit was accepted successfully and the payouts process is progressing.

Simulate Deposit - Response
json

{
  "status": "success",
  "message": "Payouts simulate deposit processed successfully",
  "data": {
    "success": true
  }
}
Finalize Payout
Finalizes a payout after the deposit has been confirmed. No request body is required — simply call this endpoint with the quoteId path parameter.

Finalize Payout
http

POST /api/payouts/quotes/:quoteId/finalize
Finalize Payout - Path Parameters
1
quoteId
string
Required
The ID of the quote to finalize.

Finalize Payout - Request
cURL

curl --request POST \
  --url https://api.bitnob.com/api/payouts/quotes/{quoteId}/finalize \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Finalize Payout Response
Note
The response is identical to that of Initialize Payout - Response. Refer to the Initialize Payout - Response section for field explanations.

Finalize Payout - Response
json

{
  "status": "success",
  "message": "Payouts quote finalized successfully",
  "data": {
    "id": "4c281868-7b0d-4c4f-bcd7-bb3bbc9248bc",
    "fees": 0,
    "chain": "trc20",
    "amount": "0.0015",
    "status": "pending_address_deposit",
    "address": "TNgGpCkphycU4pLg2LSJGUdb1mdwgMP8xs",
    "quote_id": "QT_6158",
    "btc_amount": 0.00201816,
    "from_asset": "USDT",
    "reference": "offramp-init-001",
    "sat_amount": 201816,
    "payment_eta": "3-5 minutes",
    "exchange_rate": 1636.21,
    "expires_in_text": "This invoice expires in 15 minutes",
    "payment_reason": "Supplier settlement",
    "expiry_timestamp": 1736952410,
    "settlement_amount": 327242,
    "beneficiary_details": {
      "id": "41b1e004-ce45-4591-bebe-6a2debcf05fd",
      "status": "success",
      "country": "NG",
      "currency": "NGN",
      "created_at": "2025-01-15T14:30:48.773Z",
      "reference": "QT_6158_24ccd39d2345",
      "updated_at": "2025-01-15T14:30:48.773Z",
      "destination": {
        "type": "BANK",
        "bank_code": "000014",
        "account_name": "ADA OKAFOR",
        "account_number": "0123456789"
      }
    },
    "settlement_currency": "NGN"
  }
}
Get All Quotes
This endpoint retrieves all payouts quotes initiated under your company's account. It supports pagination, sorting, and returns comprehensive data on each transaction, including quote info, status, amounts, associated customers, beneficiaries, and metadata.

Use it to list recent or historical payouts activities for reporting, reconciliation, or transaction tracking.

Get All Quotes
http

GET /api/payouts/?order=ASC&page=1&take=10
Get All Quotes Request
1
order
string
Optional
Sort order of results. Can be `ASC` (oldest to newest) or `DESC` (newest to oldest).

2
page
number
Optional
Page number for paginated results. Defaults to 1.

3
take
number
Optional
Number of results to return per page. Default is 10.

Get All Quotes - Request
cURL

curl --location 'https://api.bitnob.com/api/payouts/?order=ASC&page=1&take=10' \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Get All Quotes Response
Returns a list of payouts quotes and associated metadata including pagination details. Each quote object contains transaction details such as quote ID, customer, settlement data, status, and crypto conversion details.

1
id
string
Unique identifier for the payout transaction.

2
created_at
string
ISO 8601 timestamp indicating when the payout was created.

3
updated_at
string
ISO 8601 timestamp showing the last time the payout record was updated.

4
quote_id
string
Identifier linking this payout to its original quote.

5
company_id
string
Unique identifier of the company that initiated the payout.

6
customer_id
string
Unique identifier of the customer linked to this payout.

7
payment_reason
string
Description provided for the payout, e.g., 'Invoice Payment' or 'Business'.

8
reference
string
A unique reference string used for reconciliation or tracking.

9
callback_url
string
Webhook or callback URL provided to receive async updates. Null if not used.

10
beneficiary_id
string
Identifier linking the payout to a beneficiary record.

11
status
string
The current status of the payout. Example values include success, expired, pending, failed.

12
client_meta_data
object
Optional metadata provided by the client. Empty object if none is supplied.

13
sat_amount
string
The equivalent value of the crypto in satoshis (1 BTC = 100,000,000 sats).

14
btc_amount
string
The equivalent value of the crypto in BTC format.

15
amount
string
The amount of crypto provided in the payout request.

16
cent_amount
string
The amount represented in the smallest fiat unit (e.g., cents for USD, kobo for NGN).

17
settlement_amount
number
The final fiat amount the beneficiary receives after conversion.

18
cent_fees
string
Any fees applied to the payout, expressed in the smallest fiat unit. '0' means no fee.

19
fees
string
Any fees applied to the payout transaction in standard fiat units.

20
address
string
The deposit address (if applicable). Null for off-chain payouts.

21
source
string
The funding source for the payout, e.g., 'offchain' or 'onchain'.

22
from_asset
string
The cryptocurrency used for the payout, e.g., USDT, USDC, BTC.

23
chain
string
The blockchain network used for the transaction, e.g., trc20, erc20, BITCOIN.

24
to_currency
string
The fiat currency in which the beneficiary will be paid, e.g., NGN, KES.

25
payment_eta
string
Estimated delivery time for the payout, e.g., '3-5 minutes'.

26
expiry
string
The ISO 8601 timestamp when this payout quote or transaction expires.

27
exchange_rate
object
Conversion details including the applied rate, fiat currency, and BTC-specific fields if applicable.

28
beneficiary
object
Information about the payout beneficiary including ID, country, currency, and account details.

29
destination
object
The actual account or wallet where funds are delivered, e.g., bank account or mobile money wallet.

30
trip
object
Timeline information describing when the payout was submitted, initialized, processed, and completed.

31
company
object
Details of the company initiating the payout, including name, country, type, and compliance data.

32
allowed_features
object
A set of feature flags showing which actions the company can perform on the platform.

33
meta
object
Pagination details including page number, item count, page count, and navigation flags.

Get All Quotes - Response
json

{
    "status": "success",
    "message": "OffRamps retrieved successfully",
    "data": {
        "off_ramps": [
            {
                "id": "4d808ea1-0d16-419c-b545-881821c3e904",
                "created_at": "2025-09-09T17:17:34.374Z",
                "updated_at": "2025-09-09T17:31:58.268Z",
                "quote_id": "QT_121995",
                "company_id": "50c2b946-9c64-4e0c-88dd-3358f28026e9",
                "customer_id": "c3d681f5-d8bd-4d8f-85e0-b449ca09efda",
                "payment_reason": "Vendor payout",
                "reference": "offramp-quote-001",
                "callback_url": "https://example.com/webhooks/payouts",
                "beneficiary_id": "c03906e2-6f5b-49f9-8db6-26479710bfb6",
                "status": "success",
                "exchange_rate": {
                    "btc": {
                        "rate": 111130.8,
                        "swap_rate": 0
                    },
                    "rate": 1633.2,
                    "currency": "NGN"
                },
                "beneficiary": {
                    "id": "c03906e2-6f5b-49f9-8db6-26479710bfb6",
                    "status": "success",
                    "country": "NG",
                    "currency": "NGN",
                    "created_at": "2025-09-09T17:27:04.589Z",
                    "reference": "QT_121995_033a353bb634",
                    "updated_at": "2025-09-09T17:27:04.589Z",
                    "destination": {
                        "type": "BANK",
                        "bank_code": "110072",
                        "bank_name": "78 FINANCE COMPANY LIMITED",
                        "account_name": "JANE DOE",
                        "account_number": "1421795566"
                    }
                },
                "trip": {
                    "submitted": "1757438960",
                    "quote_sent_at": "1757438255",
                    "asset_received": null,
                    "initialized_at": "1757438825",
                    "completion_time": "1757439118",
                    "processing_start": null,
                    "time_to_completion": null
                },
                "client_meta_data": {
                    "invoice_id": "INV-1001"
                },
                "sat_amount": "179968",
                "btc_amount": "0.00179968",
                "amount": "0.0015",
                "cent_amount": "20000",
                "settlement_amount": 326640,
                "cent_fees": "0",
                "fees": "0",
                "address": "0x8b425fa3ae405c54f1fcaa16b1981c173b66a2e8",
                "source": "onchain",
                "from_asset": "USDT",
                "chain": "trc20",
                "to_currency": "NGN",
                "payment_eta": "3-5 minutes",
                "expiry": "2025-09-09T17:43:05.137Z"
            }
        ],
        "meta": {
            "page": 1,
            "take": 10,
            "item_count": 1,
            "page_count": 1,
            "has_previous_page": false,
            "has_next_page": false
        }
    }
}
Get Quote by QuoteId
This endpoint allows you to fetch detailed information about a previously generated payouts quote using its unique quoteId. This is useful for checking the status, parameters, and settlement details of the quote.

Get Quote by QuoteId
http

GET /api/payouts/quotes/{quoteId}
Path Parameters
1
quoteId
string
Required
The unique identifier of the quote you want to fetch.

Get Quote by QuoteId [cURL]
bash

curl --location 'https://api.bitnob.com/api/payouts/quotes/{quoteId}' \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Response Fields
Note
The response for Get Quote by QuoteId returns a single payout quote object with its full details including status, amounts, beneficiary, and settlement data.

Get Quote by QuoteId - Response
json

{
    "status": "success",
    "message": "OffRamps retrieved successfully",
    "data": {
        "off_ramps": [
            {
                "id": "4d808ea1-0d16-419c-b545-881821c3e904",
                "created_at": "2025-09-09T17:17:34.374Z",
                "updated_at": "2025-09-09T17:31:58.268Z",
                "quote_id": "QT_121995",
                "company_id": "50c2b946-9c64-4e0c-88dd-3358f28026e9",
                "customer_id": "c3d681f5-d8bd-4d8f-85e0-b449ca09efda",
                "payment_reason": "Vendor payout",
                "reference": "offramp-quote-001",
                "callback_url": "https://example.com/webhooks/payouts",
                "beneficiary_id": "c03906e2-6f5b-49f9-8db6-26479710bfb6",
                "status": "success",
                "exchange_rate": {
                    "btc": {
                        "rate": 111130.8,
                        "swap_rate": 0
                    },
                    "rate": 1633.2,
                    "currency": "NGN"
                },
                "beneficiary": {
                    "id": "c03906e2-6f5b-49f9-8db6-26479710bfb6",
                    "status": "success",
                    "country": "NG",
                    "currency": "NGN",
                    "created_at": "2025-09-09T17:27:04.589Z",
                    "reference": "QT_121995_033a353bb634",
                    "updated_at": "2025-09-09T17:27:04.589Z",
                    "destination": {
                        "type": "BANK",
                        "bank_code": "110072",
                        "bank_name": "78 FINANCE COMPANY LIMITED",
                        "account_name": "JANE DOE",
                        "account_number": "1421795566"
                    }
                },
                "sat_amount": "179968",
                "btc_amount": "0.00179968",
                "amount": "0.0015",
                "settlement_amount": 326640,
                "fees": "0",
                "source": "onchain",
                "from_asset": "USDT",
                "chain": "trc20",
                "to_currency": "NGN",
                "payment_eta": "3-5 minutes",
                "expiry": "2025-09-09T17:43:05.137Z"
            }
        ]
    }
}
Get Quote by Id
Get a quote by its internal transaction ID.

Get Quote by Id [GET]
http

GET /api/payouts/fetch/{id}
Path Parameters
1
id
string
Required
The unique internal ID of the quote transaction that was previously generated. This ID is required to retrieve full details.

Get Quote by Id - Request
cURL

curl --location 'https://api.bitnob.com/api/payouts/fetch/{id}' \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Get Quote by Reference
This endpoint allows you to retrieve a specific payouts quote using its unique reference. It's especially useful for systems that track transactions using external reference IDs rather than internal IDs or quote IDs.

Get Quote by Reference
http

GET /api/payouts/fetch/reference/{reference}
Path Parameters
1
reference
string
Required
Unique transaction reference that identifies the specific quote you want to retrieve.

Note
The response for Get Quote by Reference is identical to that of Get Quote by QuoteId. Refer to the Get Quote by QuoteId section for detailed response structure and field explanations.

Get Quote by Reference - Request
cURL

curl --location 'https://api.bitnob.com/api/payouts/fetch/reference/{reference}' \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Get Country Requirements
Get the beneficiary requirements for all supported countries.

Get Country Requirements
http

GET /api/payouts/supported-countries/:countryCode/requirements
Path Parameters
1
countryCode
string
Required
The ISO 3166-1 alpha-2 country code for the target country (e.g., 'NG' for Nigeria, 'KE' for Kenya).

Get Country Requirements [cURL]
bash

curl --location 'https://api.bitnob.com/api/payouts/supported-countries/NG/requirements' \
  --headers '{
    "accept": "application/json",
    "content-type": "application/json",
    "x-auth-client": "CLIENT_ID",
    "x-auth-timestamp": "ts",
    "x-auth-nonce": "nonce",
    "x-auth-signature": "signature"
  }'
Response Fields
1
status
string
Indicates if the API request was processed successfully.

2
message
string
A human-readable message describing the result of the request.

3
code
string
The ISO 3166-1 alpha-2 country code of the target country. For example, 'KE' for Kenya, 'NG' for Nigeria.

4
name
string
The full official name of the country (e.g., 'Kenya', 'Nigeria').

5
flag
string
The country's flag represented as a Unicode emoji character.

6
dial_code
string
The international telephone dialing code for the country. For example, '254' for Kenya or '234' for Nigeria.

7
destination
object
An object representing the payout destination types supported by the country (e.g., 'BANK', 'MOBILEMONEY'). Each key maps to an array of field requirement objects necessary to initiate a payout to that destination type.

Get Country Requirements - Response
json

{
  "status": "success",
  "message": "Payouts country requirement retrieved successfully",
  "data": {
    "code": "KE",
    "name": "Kenya",
    "flag": "🇰🇪",
    "dial_code": "254",
    "destination": {
      "MOBILEMONEY": [
        {
          "name": "type",
          "type": "string",
          "required": true,
          "const": "MOBILEMONEY"
        },
        {
          "name": "network",
          "type": "string",
          "required": true,
          "enum": ["MPESA"]
        },
        {
          "name": "account_name",
          "type": "string",
          "required": true
        },
        {
          "name": "account_number",
          "type": "string",
          "required": true
        }
      ]
    }
  }
}
Get Transaction Limits
This endpoint returns the minimum and maximum allowable transaction amounts for payouts operations per supported country. It provides limits in local currency as well as their equivalent values in USD based on real-time exchange rates.

Use this endpoint to validate or display country-specific limits before initiating a payout.

Get Transaction Limits
http

GET /api/payouts/limits
Response Fields
1
status
string
Indicates whether the request to retrieve transaction limits was successful.

2
message
string
A message describing the result of the request.

3
lower_limit
string
The minimum allowable payouts transaction amount in the country's local currency. Any transaction below this amount will be rejected.

4
higher_limit
string
The maximum allowable payouts transaction amount in the country's local currency. Transactions above this limit are not permitted.

5
currency
string
The local currency in which the limits are defined.

6
country
string
The two-letter ISO 3166-1 alpha-2 code representing the country (e.g., 'NG' for Nigeria, 'GH' for Ghana).

7
rate
string
The real-time exchange rate between the local currency and USD.

8
usd_lower_limit
string
The minimum transaction amount converted to USD using the current exchange rate.

9
usd_higher_limit
string
The maximum transaction amount converted to USD based on the current exchange rate.

Get Transaction Limits - Response
json

{
  "status": "success",
  "message": "Payouts limits retrieved successfully",
  "data": [
    {
      "lower_limit": "1000",
      "higher_limit": "2000000",
      "currency": "NGN",
      "country": "NG",
      "rate": "1635.81",
      "usd_lower_limit": "0.61",
      "usd_higher_limit": "1222.64"
    },
    {
      "lower_limit": "20",
      "higher_limit": "150000",
      "currency": "KES",
      "country": "KE",
      "rate": "126.73",
      "usd_lower_limit": "0.16",
      "usd_higher_limit": "1183.62"
    },
    {
      "lower_limit": "20",
      "higher_limit": "300000",
      "currency": "GHS",
      "country": "GH",
      "rate": "16.19",
      "usd_lower_limit": "1.24",
      "usd_higher_limit": "18529.96"
    },
    {
      "lower_limit": "10",
      "higher_limit": "20000",
      "currency": "AUD",
      "country": "AU",
      "rate": "1.62",
      "usd_lower_limit": "6.17",
      "usd_higher_limit": "12345.68"
    }
  ]
}


Webhooks
Learn how to listen for transactions that happen on your account

A webhook is a URL on your server where we send payloads for transaction events. For example, if you implement webhooks, we will immediately notify your server with a btc.lightning.received.success event Once a lightning payment is received. Whenever you receive a webhook notification from us, return a 200 OK to avoid resending the same event again from our server.

Verifying Events
Verifying that these events come from Bitnob is necessary to avoid creating transactions due to a fraudulent event.

To verify events, validate the x-bitnob-signature header sent with the event. The HMAC SHA512 signature is the event payload signed with your secret key.

Notification Retries
When posting notifications, we expect to receive a 200 response code from you. If the response code is not 200, we retry sending the event 3 times after the first failure.

This way, whenever you experience downtime on your end, your updates will still be sent.

Don't rely on webhooks entirely

Note
We recommend that you set up a service to always query transactions, in the event that webhooks keep failing.

Testing Webhooks
Since notifications must always be available on a publicly accessible URL, you are likely to run into issues while starting to build your application in a local environment. You can easily get around this by using a tool like ngrok or localtunnel

Create a tunnel, and update the new webhook URL setting on your dashboard. Only do this in your test environment to avoid leaking data to the public.

Verify Bitnob Webhook (Node.js - Express)
javaScript

const crypto = require('crypto');
const webhookSecret = process.env.BITNOB_WEBHOOK_SECRET;
// Using Express
app.post("/webhook_url", function(req, res) {
  //validate event
  const hash = crypto.createHmac('sha512', webhookSecret).update(JSON.stringify(req.body)).digest('hex');
  if (hash == req.headers['x-bitnob-signature']) {
  // Retrieve the request's body
  const event = req.body;
  // Do something with event  
  }
  res.send(200);
});
Virtual Cards Webhooks
Virtual card webhooks are fired when a customers perform any virtual card action.

Virtual Card creation failed
This is a webhook that is fired when virtual card creation fails

1
event
String
The specific webhook event type triggered. For example, 'virtualcard.created.failed' indicates a failed attempt to create a virtual card.

2
id
UUID
Unique identifier for the failed virtual card creation attempt. Useful for referencing the failed transaction in logs or support cases.

3
reason
String
Detailed message describing why the virtual card creation failed. Often used for debugging or notifying the user about the issue.

4
companyId
UUID
The unique identifier of the company that initiated the virtual card creation request.

5
reference
String
A unique identifier for the specific card creation request. This can be used to cross-reference requests in internal systems.

Virtual Card Creation Failed - Webhook Payload
json

{
  "event": "virtualcard.created.failed",
  "data": {
    "id": "908d33f4-e272-4971-8a52-6d06106cdd7e",
    "reason": "Something went wrong. Please try again.",
    "companyId": "c16a147e-119f-4de4-88c0-b14d908f9727",
    "reference": "CRD_CREATE_fbd95677f8da1ce1"
  }
}
Virtual Card creation successful
This is a webhook that is fired when virtual card creation is successful

1
event
String
Type of webhook event. Indicates the creation of a virtual card was successful. This helps identify the nature of the action that triggered the webhook.

2
id
String (UUID)
The unique identifier of the newly created virtual card. This ID can be used to retrieve card details, track card-related activities, or reference the card in support tickets and internal systems.

3
status
String
Current status of the virtual card. Typically 'active' if successfully created. This indicates whether the card is ready for transactions or needs further activation steps.

4
companyId
String (UUID)
The UUID of the company associated with the newly created card. It links the virtual card to the specific organization that initiated the creation request.

5
reference
String
Unique reference string used to identify the card creation request. It can be used for deduplication, auditing, reconciliation, and tracking purposes across systems.

6
createdStatus
String
Status of the creation process. Should be 'success' if the card was created without issues. This field provides a final confirmation of the card generation outcome and can be used to validate the process.

Virtual Card Created Successfully - Webhook Payload
json

{
  "event": "virtualcard.created.success",
  "data": {
    "id": "c789e3cf-31cd-4680-b820-bca71012f5dc",
    "status": "active",
    "companyId": "c16a147e-119f-4de4-88c0-b14d908f9727",
    "reference": "CRD_CREATE_b8fed75a2d1e730c",
    "createdStatus": "success"
  }
}