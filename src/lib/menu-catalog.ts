// Stock menu items with ready-made photos in /public/assets/menu (generated with Codex).
// `kind` decides which add-on groups an item gets when it is added to a shop.

export type MenuCatalogItem = {
  slug: string;
  name: string;
  category: "กาแฟ" | "ชา" | "อื่นๆ" | "เบเกอรี่";
  priceSatang: number;
  kind: "coffee" | "milk" | "drink" | "bakery";
};

export const MENU_CATALOG: MenuCatalogItem[] = [
  { slug: "espresso", name: "เอสเพรสโซ่", category: "กาแฟ", priceSatang: 4500, kind: "coffee" },
  { slug: "iced-americano", name: "อเมริกาโน่เย็น", category: "กาแฟ", priceSatang: 5500, kind: "coffee" },
  { slug: "cappuccino", name: "คาปูชิโน่", category: "กาแฟ", priceSatang: 5500, kind: "coffee" },
  { slug: "iced-mocha", name: "มอคค่า", category: "กาแฟ", priceSatang: 6000, kind: "coffee" },
  { slug: "caramel-macchiato", name: "คาราเมลมัคคิอาโต้", category: "กาแฟ", priceSatang: 6500, kind: "coffee" },
  { slug: "flat-white", name: "แฟลตไวท์", category: "กาแฟ", priceSatang: 6000, kind: "coffee" },
  { slug: "dirty-coffee", name: "เดอร์ตี้", category: "กาแฟ", priceSatang: 7000, kind: "coffee" },
  { slug: "coconut-americano", name: "อเมริกาโน่มะพร้าว", category: "กาแฟ", priceSatang: 7000, kind: "coffee" },
  { slug: "orange-espresso", name: "เอสเพรสโซ่ส้ม", category: "กาแฟ", priceSatang: 7500, kind: "coffee" },
  { slug: "oliang", name: "โอเลี้ยง", category: "กาแฟ", priceSatang: 4000, kind: "drink" },
  { slug: "green-milk-tea", name: "ชาเขียวนม", category: "ชา", priceSatang: 4500, kind: "milk" },
  { slug: "lemon-tea", name: "ชามะนาว", category: "ชา", priceSatang: 4000, kind: "drink" },
  { slug: "matcha-straight", name: "มัทฉะเพียว", category: "ชา", priceSatang: 7000, kind: "drink" },
  { slug: "coconut-matcha", name: "มัทฉะมะพร้าว", category: "ชา", priceSatang: 7500, kind: "drink" },
  { slug: "hojicha-latte", name: "โฮจิฉะลาเต้", category: "ชา", priceSatang: 6500, kind: "milk" },
  { slug: "strawberry-matcha", name: "มัทฉะสตรอว์เบอร์รี", category: "ชา", priceSatang: 8000, kind: "milk" },
  { slug: "peach-tea", name: "ชาพีช", category: "ชา", priceSatang: 5500, kind: "drink" },
  { slug: "honey-lemon-tea", name: "ชาน้ำผึ้งมะนาว", category: "ชา", priceSatang: 5000, kind: "drink" },
  { slug: "cocoa", name: "โกโก้", category: "อื่นๆ", priceSatang: 4500, kind: "milk" },
  { slug: "pink-milk", name: "นมชมพู", category: "อื่นๆ", priceSatang: 4000, kind: "milk" },
  { slug: "caramel-milk", name: "นมคาราเมล", category: "อื่นๆ", priceSatang: 4500, kind: "milk" },
  { slug: "red-lime-soda", name: "แดงมะนาวโซดา", category: "อื่นๆ", priceSatang: 4500, kind: "drink" },
  { slug: "mango-smoothie", name: "มะม่วงปั่น", category: "อื่นๆ", priceSatang: 6000, kind: "drink" },
  { slug: "butterfly-pea-lemonade", name: "อัญชันมะนาว", category: "อื่นๆ", priceSatang: 5000, kind: "drink" },
  { slug: "butter-croissant", name: "ครัวซองต์เนย", category: "เบเกอรี่", priceSatang: 5500, kind: "bakery" },
  { slug: "banana-cake", name: "เค้กกล้วยหอม", category: "เบเกอรี่", priceSatang: 4500, kind: "bakery" },
  { slug: "brownie", name: "บราวนี่", category: "เบเกอรี่", priceSatang: 5500, kind: "bakery" },
  { slug: "thai-tea-crepe-cake", name: "เครปเค้กชาไทย", category: "เบเกอรี่", priceSatang: 7500, kind: "bakery" },
  { slug: "thick-toast", name: "ปังปิ้งเนยนม", category: "เบเกอรี่", priceSatang: 4500, kind: "bakery" },
  { slug: "cinnamon-roll", name: "ซินนามอนโรล", category: "เบเกอรี่", priceSatang: 6000, kind: "bakery" },
];

export const menuImageSrc = (slug: string) => `/assets/menu/${slug}.webp`;
