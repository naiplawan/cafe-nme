import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import {
  getProduct,
  listCategories,
  listModifierGroupsForShop,
} from "@/server/menu";
import { updateProductAction } from "../actions";
import { DeleteProductForm, ProductForm } from "../forms";
import { AdminPageHeader } from "../../_components/page-header";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const [{ productId }, { shopId }] = await Promise.all([params, requireStaff()]);
  const [product, categories, modifierGroups] = await Promise.all([
    getProduct(shopId, productId),
    listCategories(shopId),
    listModifierGroupsForShop(shopId),
  ]);
  if (!product) notFound();

  const save = updateProductAction.bind(null, product.id);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="link" className="h-auto p-0" render={<Link href="/admin/menu" />}>← กลับไปหน้าเมนู</Button>
      <AdminPageHeader section="สินค้า" title={`แก้ไข ${product.name}`} description="ปรับรายละเอียดที่แสดงในเมนูและหน้าขาย" action={<DeleteProductForm productId={product.id} name={product.name} />} />
      <ProductForm
        categories={categories}
        modifierGroups={modifierGroups}
        product={product}
        action={save}
        submitLabel="บันทึกสินค้า"
      />
    </div>
  );
}
