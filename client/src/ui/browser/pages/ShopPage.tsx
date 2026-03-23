import { ShopCatalog } from "../../shop/ShopCatalog";
import { ShopCart } from "../../shop/ShopCart";

export function ShopPage() {
  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      <ShopCatalog />
      <ShopCart />
    </div>
  );
}
