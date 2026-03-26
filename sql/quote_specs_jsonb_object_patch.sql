-- quote_products.specs alanini jsonb object formatina normalize eder
-- hedef format:
-- {"items": ["...", "..."], "text": "...\n..."}

update public.quote_products
set specs = jsonb_build_object(
  'items',
    case
      when jsonb_typeof(specs) = 'object' and specs ? 'items' and jsonb_typeof(specs->'items') = 'array' then specs->'items'
      when jsonb_typeof(specs) = 'array' then specs
      when jsonb_typeof(specs) = 'string' then to_jsonb(array_remove(regexp_split_to_array(trim(both '"' from specs::text), E'\\r?\\n|,|;|•'), ''))
      else '[]'::jsonb
    end,
  'text',
    case
      when jsonb_typeof(specs) = 'object' and specs ? 'text' then coalesce(specs->>'text', '')
      when jsonb_typeof(specs) = 'array' then (
        select string_agg(value, E'\n')
        from jsonb_array_elements_text(specs) as t(value)
      )
      when jsonb_typeof(specs) = 'string' then trim(both '"' from specs::text)
      else ''
    end
)
where specs is not null;
