import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import {
  getProduct,
  listCategories,
  listModifierGroupsForShop,
} from "@/server/menu";
import { AdminPageHeader } from "../../_components/page-header";
import { updateProductAction } from "../actions";
import { DeleteProductForm, ProductForm } from "../forms";
import { menuReturnHref } from "../menu-steps";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ productId }, { back }, { shopId }] = await Promise.all([params, searchParams, requireStaff()]);
  const [product, categories, modifierGroups] = await Promise.all([
    getProduct(shopId, productId),
    listCategories(shopId),
    listModifierGroupsForShop(shopId),
  ]);
  if (!product) notFound();

  const save = updateProductAction.bind(null, product.id);
  const returnHref = menuReturnHref(back);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={returnHref} className={buttonVariants({ variant: "link" })}><ArrowLeft aria-hidden="true" size={16} /> กลับไปหน้าเมนู</Link>
      <AdminPageHeader section="สินค้า" title={`แก้ไข ${product.name}`} description="ปรับรายละเอียดที่แสดงในเมนูและหน้าขาย" action={<DeleteProductForm productId={product.id} name={product.name} />} />
      <div className="rounded-xl border bg-card px-4 pt-4 sm:px-5 sm:pt-5">
      <ProductForm
        categories={categories}
        modifierGroups={modifierGroups}
        product={product}
        action={save}
        submitLabel="บันทึกสินค้า"
        returnHref={returnHref}
      />
      </div>
    </div>
  );
}
