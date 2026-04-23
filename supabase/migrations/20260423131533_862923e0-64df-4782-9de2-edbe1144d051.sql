CREATE TABLE public.warehouse_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  location TEXT NOT NULL DEFAULT 'Almacén principal',
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  unit TEXT NOT NULL DEFAULT 'pz',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouse_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.warehouse_products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  responsible TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  resulting_stock INTEGER NOT NULL DEFAULT 0 CHECK (resulting_stock >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view warehouse products"
ON public.warehouse_products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create warehouse products"
ON public.warehouse_products
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouse products"
ON public.warehouse_products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can view warehouse movements"
ON public.warehouse_movements
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create warehouse movements"
ON public.warehouse_movements
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_warehouse_products_updated_at
BEFORE UPDATE ON public.warehouse_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_warehouse_movement()
RETURNS TRIGGER AS $$
DECLARE
  next_stock INTEGER;
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE public.warehouse_products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id
    RETURNING current_stock INTO next_stock;
  ELSE
    UPDATE public.warehouse_products
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id
      AND current_stock >= NEW.quantity
    RETURNING current_stock INTO next_stock;

    IF next_stock IS NULL THEN
      RAISE EXCEPTION 'Stock insuficiente para registrar la salida';
    END IF;
  END IF;

  NEW.resulting_stock = next_stock;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER apply_warehouse_movement_before_insert
BEFORE INSERT ON public.warehouse_movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_warehouse_movement();

CREATE INDEX idx_warehouse_products_sku ON public.warehouse_products (sku);
CREATE INDEX idx_warehouse_products_status ON public.warehouse_products (status);
CREATE INDEX idx_warehouse_movements_product_id ON public.warehouse_movements (product_id);
CREATE INDEX idx_warehouse_movements_created_at ON public.warehouse_movements (created_at DESC);