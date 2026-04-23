DROP POLICY IF EXISTS "Authenticated users can create warehouse products" ON public.warehouse_products;
DROP POLICY IF EXISTS "Authenticated users can update warehouse products" ON public.warehouse_products;
DROP POLICY IF EXISTS "Authenticated users can create warehouse movements" ON public.warehouse_movements;

CREATE POLICY "Signed-in users can create warehouse products"
ON public.warehouse_products
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Signed-in users can update warehouse products"
ON public.warehouse_products
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Signed-in users can create warehouse movements"
ON public.warehouse_movements
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');