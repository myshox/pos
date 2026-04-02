-- POS 多台同步：請在 Supabase → SQL Editor 貼上「整份檔案」執行。
-- 不要貼 Markdown（.md）或含 # 標題的文字；只貼本檔內容。
-- 執行前請把「請換成你的店鋪密鑰」改成你自訂的字串（並與 VITE_STORE_KEY 相同）。

create table if not exists store_data (
  id text primary key default 'default',
  store_key text not null default '',
  products jsonb not null default '[]',
  orders jsonb not null default '[]',
  categories jsonb not null default '[]',
  store_settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 先寫入一列（此時尚未啟用 RLS，不會被擋）
insert into public.store_data (id, store_key, products, orders, categories, store_settings)
values ('default', '請換成你的店鋪密鑰', '[]', '[]', '[]', '{}')
on conflict (id) do update set store_key = excluded.store_key;

alter table store_data enable row level security;

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

-- 若報錯，改到 Database → Replication 手動加入 store_data
alter publication supabase_realtime add table store_data;
