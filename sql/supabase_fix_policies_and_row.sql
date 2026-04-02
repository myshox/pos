-- 若 App 顯示「讀不到 id=default」：在 Supabase → SQL Editor 貼上執行（勿含 # 標題）
-- 把 YOUR_STORE_KEY 改成與 Cloudflare「VITE_STORE_KEY」完全相同（例：mogu-pos-2026-abc123）

insert into public.store_data (id, store_key, products, orders, categories, store_settings)
values ('default', 'YOUR_STORE_KEY', '[]', '[]', '[]', '{}')
on conflict (id) do update set store_key = excluded.store_key;

alter table public.store_data enable row level security;

drop policy if exists "Allow all for store_data" on public.store_data;
drop policy if exists "store_data_read_with_key" on public.store_data;
drop policy if exists "store_data_write_with_key" on public.store_data;
drop policy if exists "store_data_update_with_key" on public.store_data;

create policy "store_data_read_with_key"
  on public.store_data for select
  using (
    trim(both from coalesce(
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}'))::json->>'x-store-key',
      ''
    )) = trim(both from store_key)
  );

create policy "store_data_write_with_key"
  on public.store_data for insert
  with check (
    trim(both from coalesce(
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}'))::json->>'x-store-key',
      ''
    )) = trim(both from store_key)
  );

create policy "store_data_update_with_key"
  on public.store_data for update
  using (
    trim(both from coalesce(
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}'))::json->>'x-store-key',
      ''
    )) = trim(both from store_key)
  )
  with check (
    trim(both from coalesce(
      (coalesce(nullif(current_setting('request.headers', true), ''), '{}'))::json->>'x-store-key',
      ''
    )) = trim(both from store_key)
  );
