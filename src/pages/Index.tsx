import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Factory,
  Gauge,
  PackagePlus,
  Radar,
  Search,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"warehouse_products">;
type Movement = Tables<"warehouse_movements"> & { warehouse_products?: Pick<Product, "name" | "sku" | "unit"> | null };

const emptyProduct = {
  sku: "",
  name: "",
  category: "Mecánica",
  location: "Rack A-01",
  current_stock: 0,
  min_stock: 10,
  unit: "pz",
};

const emptyMovement = {
  product_id: "",
  movement_type: "in",
  quantity: 1,
  responsible: "",
  reference: "",
  notes: "",
};

const Index = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [movementForm, setMovementForm] = useState(emptyMovement);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const ensureSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) await supabase.auth.signInAnonymously();
  };

  const loadWarehouse = async () => {
    setLoading(true);
    const [productsResult, movementsResult] = await Promise.all([
      supabase.from("warehouse_products").select("*").order("name"),
      supabase
        .from("warehouse_movements")
        .select("*, warehouse_products(name, sku, unit)")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (productsResult.error || movementsResult.error) {
      toast({ title: "No se pudo cargar el almacén", description: productsResult.error?.message || movementsResult.error?.message });
    } else {
      setProducts(productsResult.data || []);
      setMovements((movementsResult.data || []) as Movement[]);
      if (!movementForm.product_id && productsResult.data?.[0]) {
        setMovementForm((current) => ({ ...current, product_id: productsResult.data[0].id }));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    ensureSession().then(loadWarehouse);
  }, []);

  const stats = useMemo(() => {
    const totalStock = products.reduce((sum, item) => sum + item.current_stock, 0);
    const lowStock = products.filter((item) => item.current_stock <= item.min_stock).length;
    const categories = new Set(products.map((item) => item.category)).size;
    return { totalStock, lowStock, categories, active: products.length };
  }, [products]);

  const filteredProducts = products.filter((product) =>
    [product.name, product.sku, product.category, product.location].join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  const createProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("warehouse_products").insert(productForm);
    setSaving(false);
    if (error) return toast({ title: "Producto no registrado", description: error.message });
    setProductForm(emptyProduct);
    toast({ title: "Producto agregado", description: "El artículo ya está disponible para movimientos." });
    loadWarehouse();
  };

  const createMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("warehouse_movements").insert({
      product_id: movementForm.product_id,
      movement_type: movementForm.movement_type,
      quantity: Number(movementForm.quantity),
      responsible: movementForm.responsible,
      reference: movementForm.reference || null,
      notes: movementForm.notes || null,
    });
    setSaving(false);
    if (error) return toast({ title: "Movimiento rechazado", description: error.message });
    setMovementForm({ ...emptyMovement, product_id: movementForm.product_id });
    toast({ title: "Movimiento aplicado", description: "El stock se recalculó automáticamente." });
    loadWarehouse();
  };

  return (
    <main className="warehouse-grid min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel-gradient relative overflow-hidden rounded-lg border border-border p-5 shadow-panel sm:p-7">
          <div className="absolute inset-x-0 top-0 h-24 bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
                  <Radar className="h-4 w-4" /> Centro de control interno
                </div>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-5xl lg:text-6xl">
                  Flujo de almacén en tiempo real
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Controla entradas, salidas, mínimos críticos y trazabilidad operativa desde una cabina oscura y precisa.
                </p>
              </div>
              <div className="motion-safe-float relative h-36 w-full max-w-xs rounded-lg border border-primary/20 bg-surface-elevated p-4 shadow-glow md:w-64">
                <div className="absolute inset-x-6 top-7 h-1 animate-scan-line rounded-full bg-primary shadow-glow" />
                <Factory className="mb-4 h-8 w-8 text-primary" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded-full bg-muted" />
                  <div className="h-3 w-44 rounded-full bg-secondary" />
                  <div className="h-3 w-24 rounded-full bg-accent/60" />
                </div>
              </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Stock total", stats.totalStock, Boxes],
                ["Productos activos", stats.active, Gauge],
                ["Categorías", stats.categories, Truck],
                ["Alertas mínimas", stats.lowStock, ShieldAlert],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-card/70 p-4 transition hover:-translate-y-1 hover:border-primary/40">
                  <Icon className="mb-4 h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">{label as string}</p>
                  <p className="mt-1 text-3xl font-semibold text-foreground">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={createMovement} className="panel-gradient rounded-lg border border-border p-5 shadow-panel sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-primary">Registro rápido</p>
              <h2 className="text-2xl font-semibold">Entrada / salida</h2>
            </div>
            {movementForm.movement_type === "in" ? <ArrowDownToLine className="h-7 w-7 text-success" /> : <ArrowUpFromLine className="h-7 w-7 text-destructive" />}
          </div>
          <div className="grid gap-3">
            <select className="h-11 rounded-md border border-border px-3" value={movementForm.product_id} onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })} required>
              <option value="">Seleccionar producto</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select className="h-11 rounded-md border border-border px-3" value={movementForm.movement_type} onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}>
                <option value="in">Entrada</option>
                <option value="out">Salida</option>
              </select>
              <input className="h-11 rounded-md border border-border px-3" type="number" min="1" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })} required />
            </div>
            <input className="h-11 rounded-md border border-border px-3" placeholder="Responsable" value={movementForm.responsible} onChange={(e) => setMovementForm({ ...movementForm, responsible: e.target.value })} required />
            <input className="h-11 rounded-md border border-border px-3" placeholder="Orden, folio o referencia" value={movementForm.reference} onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })} />
            <textarea className="min-h-20 rounded-md border border-border px-3 py-2" placeholder="Notas" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />
            <Button variant="command" disabled={saving || !products.length}><Activity className="h-4 w-4" /> Aplicar movimiento</Button>
          </div>
        </form>
      </section>

      <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <form onSubmit={createProduct} className="rounded-lg border border-border bg-card/80 p-5 shadow-panel">
          <div className="mb-5 flex items-center gap-3">
            <PackagePlus className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Nuevo producto</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <input className="h-11 rounded-md border border-border px-3" placeholder="SKU" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} required />
            <input className="h-11 rounded-md border border-border px-3" placeholder="Nombre" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
            <input className="h-11 rounded-md border border-border px-3" placeholder="Categoría" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} required />
            <input className="h-11 rounded-md border border-border px-3" placeholder="Ubicación" value={productForm.location} onChange={(e) => setProductForm({ ...productForm, location: e.target.value })} required />
            <input className="h-11 rounded-md border border-border px-3" type="number" min="0" placeholder="Stock inicial" value={productForm.current_stock} onChange={(e) => setProductForm({ ...productForm, current_stock: Number(e.target.value) })} />
            <input className="h-11 rounded-md border border-border px-3" type="number" min="0" placeholder="Stock mínimo" value={productForm.min_stock} onChange={(e) => setProductForm({ ...productForm, min_stock: Number(e.target.value) })} />
            <input className="h-11 rounded-md border border-border px-3" placeholder="Unidad" value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} />
            <Button variant="panel" disabled={saving}><CheckCircle2 className="h-4 w-4" /> Guardar producto</Button>
          </div>
        </form>

        <div className="rounded-lg border border-border bg-card/80 p-5 shadow-panel">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Inventario activo</h2>
            <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-input px-3 text-sm text-muted-foreground sm:w-72">
              <Search className="h-4 w-4" />
              <input className="w-full border-0 bg-transparent outline-none" placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3">
            {loading ? <p className="text-muted-foreground">Sincronizando datos...</p> : filteredProducts.map((product) => {
              const low = product.current_stock <= product.min_stock;
              return (
                <article key={product.id} className="grid gap-3 rounded-lg border border-border bg-surface/70 p-4 transition hover:border-primary/40 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">{product.sku}</span>
                      <span className={low ? "rounded-md bg-destructive/20 px-2 py-1 text-xs text-destructive" : "rounded-md bg-success/20 px-2 py-1 text-xs text-success"}>{low ? "Mínimo crítico" : "Operativo"}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category} · {product.location}</p>
                  </div>
                  <div className="min-w-28 text-left md:text-right">
                    <p className="text-3xl font-semibold">{product.current_stock}</p>
                    <p className="text-sm text-muted-foreground">{product.unit} · mín. {product.min_stock}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-7xl rounded-lg border border-border bg-card/80 p-5 shadow-panel">
        <h2 className="mb-4 text-2xl font-semibold">Actividad reciente</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {movements.map((movement) => (
            <div key={movement.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/60 p-3">
              <div className="flex items-center gap-3">
                <span className={movement.movement_type === "in" ? "rounded-md bg-success/20 p-2 text-success" : "rounded-md bg-destructive/20 p-2 text-destructive"}>
                  {movement.movement_type === "in" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                </span>
                <div>
                  <p className="font-medium">{movement.warehouse_products?.name || "Producto"}</p>
                  <p className="text-sm text-muted-foreground">{movement.responsible} · {movement.reference || "sin referencia"}</p>
                </div>
              </div>
              <p className="text-right text-sm"><span className="block text-lg font-semibold">{movement.quantity}</span> saldo {movement.resulting_stock}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Index;