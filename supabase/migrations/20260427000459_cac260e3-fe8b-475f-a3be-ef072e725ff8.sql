ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS realtime_toast_severity text NOT NULL DEFAULT 'all'
CHECK (realtime_toast_severity IN ('all', 'warnings_and_errors', 'errors_only', 'none'));