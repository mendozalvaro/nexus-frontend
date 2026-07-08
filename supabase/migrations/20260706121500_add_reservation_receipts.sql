create table if not exists reservation_receipt_sequences (
    organization_id uuid references organizations(id) on delete cascade not null,
    receipt_year integer not null check (receipt_year >= 2000),
    last_value integer not null default 0 check (last_value >= 0),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    primary key (organization_id, receipt_year)
);

alter table reservation_payments
    add column if not exists receipt_kind text check (receipt_kind in ('partial', 'final')),
    add column if not exists receipt_year integer,
    add column if not exists receipt_sequence integer,
    add column if not exists receipt_number text;

create unique index if not exists idx_reservation_payments_receipt_number
    on reservation_payments (organization_id, receipt_number)
    where receipt_number is not null;

create or replace function next_reservation_receipt_number(
    p_organization_id uuid,
    p_paid_at timestamptz default now()
)
returns table (
    receipt_year integer,
    receipt_sequence integer,
    receipt_number text
)
language sql
as $$
    with target_year as (
        select extract(year from timezone('UTC', p_paid_at))::integer as value
    ),
    next_value as (
        insert into reservation_receipt_sequences as seq (
            organization_id,
            receipt_year,
            last_value
        )
        select
            p_organization_id,
            target_year.value,
            1
        from target_year
        on conflict (organization_id, receipt_year)
        do update set
            last_value = seq.last_value + 1,
            updated_at = now()
        returning seq.receipt_year, seq.last_value
    )
    select
        next_value.receipt_year,
        next_value.last_value as receipt_sequence,
        format('REC-%s-%s', next_value.receipt_year, lpad(next_value.last_value::text, 6, '0')) as receipt_number
    from next_value;
$$;
