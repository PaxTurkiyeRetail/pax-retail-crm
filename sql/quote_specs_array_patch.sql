-- Eski object formatli specs kayitlarini jsonb array formata cevirir.
-- Hedef format: ["Android 12", "IP67"]

update public.quote_products
set specs = case
  when jsonb_typeof(specs) = 'array' then specs
  when jsonb_typeof(specs) = 'object' and jsonb_typeof(specs->'items') = 'array' then specs->'items'
  when jsonb_typeof(specs) = 'object' and coalesce(specs->>'text', '') <> '' then (
    select coalesce(jsonb_agg(line), '[]'::jsonb)
    from (
      select trim(value) as line
      from regexp_split_to_table(specs->>'text', E'\\r?\\n') as value
      where trim(value) <> ''
    ) t
  )
  when jsonb_typeof(specs) = 'string' then (
    select coalesce(jsonb_agg(line), '[]'::jsonb)
    from (
      select trim(value) as line
      from regexp_split_to_table(trim(both '"' from specs::text), E'\\r?\\n') as value
      where trim(value) <> ''
    ) t
  )
  else '[]'::jsonb
end
where specs is not null;
