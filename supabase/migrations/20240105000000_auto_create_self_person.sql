-- Auto-create a "self" person record when a new user signs up.
-- This ensures the NL pipeline can resolve "me"/"I" immediately.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  display TEXT;
  first TEXT;
  last TEXT;
BEGIN
  display := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, display);

  -- Split display name into first/last
  first := split_part(display, ' ', 1);
  last := CASE
    WHEN position(' ' in display) > 0 THEN substring(display from position(' ' in display) + 1)
    ELSE ''
  END;

  INSERT INTO public.persons (user_id, linked_user_id, first_name, last_name, email, relationship_type)
  VALUES (NEW.id, NEW.id, first, last, NEW.email, 'self');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
