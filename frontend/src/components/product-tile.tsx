import { cn } from "cn";
import { thaiInitial } from "@/lib/thai";
import { tileClasses, tileColorOf } from "@/lib/tile-colors";

/** Stand-in for a product photo: the name's first letter on the product's tile colour. */
export function ProductTile({ name, tileColor, className }: { name: string; tileColor?: string | null; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center font-bold", tileClasses(tileColorOf({ name, tileColor })), className)}>
      {thaiInitial(name)}
    </div>
  );
}
