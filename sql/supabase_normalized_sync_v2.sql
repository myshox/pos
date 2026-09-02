-- Mogu POS v2 sync schema. Safe to run repeatedly.
-- Keeps public.store_data untouched as a rollback source.

create table if not exists public.pos_products (
  id text primary key,
  store_key text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.pos_orders (
  id text primary key,
  store_key text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.pos_settings (
  id text primary key default 'default',
  store_key text not null,
  categories jsonb not null default '[]',
  store_settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists pos_products_updated_at_idx on public.pos_products (updated_at desc);
create index if not exists pos_orders_updated_at_idx on public.pos_orders (updated_at desc);
-- createdAt is stored as ISO-8601, whose text ordering matches chronological ordering.
create index if not exists pos_orders_created_at_idx on public.pos_orders ((data->>'createdAt') desc)
  where data ? 'createdAt' and deleted_at is null;

insert into public.pos_products (id, store_key, data, updated_at, deleted_at)
select
  product->>'id',
  source.store_key,
  product - '_deleted',
  coalesce(nullif(product->>'_syncUpdatedAt', '')::timestamptz, source.updated_at),
  case when coalesce((product->>'_deleted')::boolean, false)
    then coalesce(nullif(product->>'_syncUpdatedAt', '')::timestamptz, source.updated_at)
  end
from public.store_data source
cross join lateral jsonb_array_elements(source.products) product
where source.id = 'default' and product ? 'id'
on conflict (id) do update set
  store_key = excluded.store_key,
  data = excluded.data,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at
where excluded.updated_at >= public.pos_products.updated_at;

insert into public.pos_orders (id, store_key, data, updated_at, deleted_at)
select
  order_row->>'id',
  source.store_key,
  order_row - '_deleted',
  coalesce(nullif(order_row->>'_syncUpdatedAt', '')::timestamptz, source.updated_at),
  case when coalesce((order_row->>'_deleted')::boolean, false)
    then coalesce(nullif(order_row->>'_syncUpdatedAt', '')::timestamptz, source.updated_at)
  end
from public.store_data source
cross join lateral jsonb_array_elements(source.orders) order_row
where source.id = 'default' and order_row ? 'id'
on conflict (id) do update set
  store_key = excluded.store_key,
  data = excluded.data,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at
where excluded.updated_at >= public.pos_orders.updated_at;

insert into public.pos_settings (id, store_key, categories, store_settings, updated_at)
select 'default', store_key, categories, store_settings, updated_at
from public.store_data where id = 'default'
on conflict (id) do update set
  store_key = excluded.store_key,
  categories = excluded.categories,
  store_settings = excluded.store_settings,
  updated_at = excluded.updated_at;

alter table public.pos_products enable row level security;
alter table public.pos_orders enable row level security;
alter table public.pos_settings enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['pos_products', 'pos_orders', 'pos_settings'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_read_with_key', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_with_key', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_with_key', table_name);
    execute format(
      'create policy %I on public.%I for select to anon using (trim(coalesce((coalesce(nullif(current_setting(''request.headers'', true), ''''), ''{}''))::json->>''x-store-key'', '''')) = trim(store_key))',
      table_name || '_read_with_key', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to anon with check (trim(coalesce((coalesce(nullif(current_setting(''request.headers'', true), ''''), ''{}''))::json->>''x-store-key'', '''')) = trim(store_key))',
      table_name || '_insert_with_key', table_name
    );
    execute format(
      'create policy %I on public.%I for update to anon using (trim(coalesce((coalesce(nullif(current_setting(''request.headers'', true), ''''), ''{}''))::json->>''x-store-key'', '''')) = trim(store_key)) with check (trim(coalesce((coalesce(nullif(current_setting(''request.headers'', true), ''''), ''{}''))::json->>''x-store-key'', '''')) = trim(store_key))',
      table_name || '_update_with_key', table_name
    );
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pos_products') then
    alter publication supabase_realtime add table public.pos_products;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pos_orders') then
    alter publication supabase_realtime add table public.pos_orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pos_settings') then
    alter publication supabase_realtime add table public.pos_settings;
  end if;
end $$;

select
  (select count(*) from public.pos_products where deleted_at is null) as active_products,
  (select count(*) from public.pos_orders where deleted_at is null) as active_orders,
  (select count(*) from public.pos_settings) as settings_rows;
