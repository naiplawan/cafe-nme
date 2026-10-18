UPDATE products
SET image_url = '/api/menu-assets/menu/' || substring(image_url FROM length('/assets/menu/') + 1)
WHERE image_url LIKE '/assets/menu/%.webp';

UPDATE products
SET image_url = '/api/menu-assets/' || substring(image_url FROM length('/assets/') + 1)
WHERE image_url IN (
  '/assets/product-americano.png',
  '/assets/product-latte.png',
  '/assets/product-thai-tea.png',
  '/assets/product-matcha-latte.png'
);
