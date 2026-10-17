UPDATE shops
SET promptpay_id = NULL
WHERE slug = 'demo-cafe'
  AND promptpay_id = '0812345678';
