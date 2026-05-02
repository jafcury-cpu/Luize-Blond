CREATE TABLE public.category_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  external_category text NOT NULL,
  internal_category text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own category_mappings"
ON public.category_mappings FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_category_mappings_user_external
ON public.category_mappings (user_id, lower(external_category));

CREATE TRIGGER update_category_mappings_updated_at
BEFORE UPDATE ON public.category_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();