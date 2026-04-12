const axios = require('axios');

const FACILITATOR_URL = 'https://facilitator.pieverse.io';

/**
 * x402 middleware
 * No X-PAYMENT header -> return 402 with payment requirements
 * X-PAYMENT present -> verify with Pieverse facilitator -> settle -> proceed
 */
function x402Required({ amount, description, merchantName }) {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-payment'];

    if (!paymentHeader) {
      return res.status(402).json({
        error: 'X-PAYMENT header is required',
        accepts: [{
          scheme: 'gokite-aa',
          network: process.env.KITE_NETWORK || 'kite-testnet',
          maxAmountRequired: amount,
          resource: `${process.env.BASE_URL || 'http://localhost:8080'}${req.path}`,
          description,
          mimeType: 'application/json',
          outputSchema: {
            input: { discoverable: true, method: req.method, type: 'http' },
            output: {
              properties: {
                orderId:  { type: 'string' },
                txHash:   { type: 'string' },
                status:   { type: 'string' },
              },
              required: ['orderId', 'txHash', 'status'],
              type: 'object',
            },
          },
          payTo: process.env.VAULT_ADDRESS,
          maxTimeoutSeconds: 300,
          asset: process.env.USDC_ADDRESS || '0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9',
          extra: null,
          merchantName,
        }],
        x402Version: 1,
      });
    }

    try {
      const paymentData = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString('utf8')
      );

      // Verify
      const verifyRes = await axios.post(`${FACILITATOR_URL}/v2/verify`, {
        authorization: paymentData.authorization,
        signature: paymentData.signature,
        network: process.env.KITE_NETWORK || 'kite-testnet',
      });

      if (!verifyRes.data.valid) {
        return res.status(402).json({ error: 'Payment verification failed' });
      }

      // Settle on-chain
      await axios.post(`${FACILITATOR_URL}/v2/settle`, {
        authorization: paymentData.authorization,
        signature: paymentData.signature,
        network: process.env.KITE_NETWORK || 'kite-testnet',
      });

      req.paymentVerified = true;
      req.paymentData = paymentData;
      next();
    } catch (err) {
      return res.status(402).json({ error: 'Payment failed', details: err.message });
    }
  };
}

module.exports = { x402Required };